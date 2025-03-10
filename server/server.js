const fs = require("fs");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("../client"));
app.use(express.json());

/* SCHEMA
users = { socketID: {roomCode: roomCode, username: username, score: 0}, ... }

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

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateUsername = () => random(
    JSON.parse(fs.readFileSync("./word-list.json", "utf-8"))["usernames"]
);

const getUsernamesInRoom = (roomCode) => {
    return Object.values(users)
        .filter(user => user.roomCode === roomCode)
        .map(user => user.username);
};

// TESTING
rooms["test"] = {
    gameData: {
        drew: [],
        currentWord: null,
        currentDrawer: null,
        round: 1,
        isActive: false
    }
}

app.post("/create-room", (req, res) => {
    const { roomCode, user } = req.body;

    if (rooms[roomCode]) {
        return res.send({ "error": "Room already exists" }); // Room already exists
    }

    rooms[roomCode] = {
        gameData: {
            drew: [],
            currentWord: null,
            currentDrawer: null,
            round: 1,
            isActive: false
        }
    };

    console.log("Room created : " + roomCode);

    res.send({ roomCode });
});


io.on("connection", (socket) => {
    console.log("[USER CONNECT] A user connected:", socket.id);

    socket.on("leave-room", () => {
        console.log("[LEAVE ROOM] User " + JSON.stringify(users[socket.id]));

        const roomCode = users[socket.id].roomCode;
        
        if (roomCode) {
            const { [socket.id]: _, ...rest } = users;
            users = rest;
            
            io.to(roomCode).emit("user-left", {users: Object.values(users)});
            socket.leave(roomCode);

            if (!io.sockets.adapter.rooms.get(roomCode)) {
                const { [roomCode]: _, ...rest } = rooms;
                rooms = rest;
                console.log(`Room ${roomCode} deleted`);
            }
        }


    });

    socket.on("join-room", (roomCode) => {
        roomCode = roomCode.roomCode;

        console.log("Joining room: " + roomCode);

        if (!rooms[roomCode]) {
            socket.emit("error", 404);
            return;
        }

        let username = generateUsername();
        while (getUsernamesInRoom(roomCode).includes(username)) {
            username = generateUsername(); // Generate a unique username for the user
        }

        socket.join(roomCode);
        users[socket.id] = { roomCode, username, score: 0 };

        console.log(`${socket.id} joined room ${roomCode} with username ${username}`);

        io.to(roomCode).emit("user-joined", {
            username, roomCode, score: 0, users: Object.values(users)
                .filter(user => user.roomCode === roomCode)
        });

        if (io.sockets.adapter.rooms.get(roomCode).size >= 5) { // Start the game
            rooms[roomCode].gameData.isActive = true;
            rooms[roomCode].gameData.currentDrawer = random(Array.from(io.sockets.adapter.rooms.get(roomCode)));
            rooms[roomCode].gameData.currentWord = random(JSON.parse(fs.readFileSync("./word-list.json", "utf-8"))["words"]);

            io.to(roomCode).emit("game-started", rooms[roomCode].gameData);
            console.log("Game Started: " + JSON.stringify(rooms[roomCode].gameData));
        }
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
        console.log("[USER DISCONNECT] Users: " + JSON.stringify(users));
        
        if (!users[socket.id]) {
            return;
        }

        const roomCode = users[socket.id].roomCode;
        if (roomCode) {
            socket.leave(roomCode);
            const { [socket.id]: _, ...rest } = users;
            users = rest;

            // TODO: Fix
            // Check if room is empty 
            if (!io.sockets.adapter.rooms.get(roomCode)) {
                const { [roomCode]: _, ...rest } = rooms;
                rooms = rest;
                console.log(`Room ${roomCode} deleted`);
            }
        }

        io.to(roomCode).emit("user-left", Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
