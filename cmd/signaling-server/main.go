package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	addr = flag.String("addr", "localhost:8080", "http service address")
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

type MessageType int

const (
	Offer MessageType = iota
	Answer
	IceCandidate
	PeerDiscovery
	Heartbeat
	Register
	Unregister
	Broadcast
)

type SignalMessage struct {
	Type      MessageType     `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	SenderID  string          `json:"sender_id"`
	Timestamp time.Time       `json:"timestamp"`
	RoomID    string          `json:"room_id"`
}

type Client struct {
	ID     string
	Conn   *websocket.Conn
	Send   chan []byte
	RoomID string
	mu     sync.RWMutex
}

type Hub struct {
	Clients    map[string]*Client
	Rooms      map[string]map[string]*Client
	Broadcast  chan SignalMessage
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[string]*Client),
		Rooms:      make(map[string]map[string]*Client),
		Broadcast:  make(chan SignalMessage),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client.ID] = client
			
			// Create room if it doesn't exist
			if _, ok := h.Rooms[client.RoomID]; !ok {
				h.Rooms[client.RoomID] = make(map[string]*Client)
			}
			h.Rooms[client.RoomID][client.ID] = client
			h.mu.Unlock()
			
			log.Printf("Client %s registered in room %s", client.ID, client.RoomID)
			
		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				if room, ok := h.Rooms[client.RoomID]; ok {
					delete(room, client.ID)
					if len(room) == 0 {
						delete(h.Rooms, client.RoomID)
					}
				}
				close(client.Send)
			}
			h.mu.Unlock()
			
			log.Printf("Client %s unregistered", client.ID)
			
		case message := <-h.Broadcast:
			h.mu.RLock()
			clientsInRoom, ok := h.Rooms[message.RoomID]
			if ok {
				for _, client := range clientsInRoom {
					if client.ID != message.SenderID {
						select {
						case client.Send <- message.Payload:
						default:
							// Remove client if send fails
							h.Unregister <- client
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var signalMsg SignalMessage
		if err := json.Unmarshal(message, &signalMsg); err != nil {
			log.Printf("error unmarshaling message: %v", err)
			continue
		}

		signalMsg.SenderID = c.ID
		hub.Broadcast <- signalMsg
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				// Channel closed, exit
				return
			}

			c.mu.Lock()
			err := c.Conn.WriteMessage(websocket.TextMessage, message)
			c.mu.Unlock()
			
			if err != nil {
				log.Printf("write error: %v", err)
				return
			}
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade error:", err)
		return
	}

	clientID := r.URL.Query().Get("id")
	if clientID == "" {
		clientID = generateClientID()
	}

	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		roomID = "default"
	}

	client := &Client{
		ID:     clientID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		RoomID: roomID,
	}

	hub.Register <- client

	go client.WritePump()
	client.ReadPump(hub)
}

func generateClientID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func main() {
	flag.Parse()
	
	hub := NewHub()
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	log.Printf("Starting signaling server on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}