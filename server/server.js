const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("../client"));
app.use(express.json());

/* SCHEMA
users = { socketID: roomCode, ... }

rooms = {
    roomCode: {
        gameData: {
            currentWord: word,
            currentDrawer: userID,
            isActive: boolean
        }
    }
}
*/

let users = {}; 
let rooms = {}; 
let messages = [];

app.post("/create-room", (req, res) => {
    const { roomCode, user } = req.body;

    if (rooms[roomCode]) {
        return res.send(null); // Room already exists
    }

    rooms[roomCode] = {
        gameData: {
            currentWord: null,
            currentDrawer: null,
            isActive: false
        }
    };

    res.send({ roomCode });
});

app.post("/join-room", (req, res) => {
    const { roomCode, user } = req.body;

    if (!rooms[roomCode]) {
        return res.send(null); // Room not found
    }

    res.send({ roomCode });
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (roomCode) => {
        socket.join(roomCode);
        users[socket.id] = roomCode;

        console.log(`${socket.id} joined room ${roomCode}`);

        io.to(roomCode).emit("user-joined", { userId: socket.id });
    });

    socket.on("draw", (data) => {
        const roomCode = users[socket.id];
        if (roomCode) {
            socket.to(roomCode).emit("draw", data); 
        }
    });

    socket.on("chat", (message) => {
        const roomCode = users[socket.id];
        if (roomCode) {
            io.to(roomCode).emit("chat", message); 
        }
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);

        const roomCode = users[socket.id];
        if (roomCode) {
            socket.leave(roomCode);
            const {[socket.id]: _, ...rest} = users;
            users = rest;

            // Check if room is empty
            if (io.sockets.adapter.rooms.get(roomCode)?.size === 0) {
                const {[roomCode]: _, ...rest} = rooms;
                rooms = rest;
                console.log(`Room ${roomCode} deleted`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
