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
users = { socketID: {roomCode: roomCode, username: username, score: 0, guessed: false, color: 0}, ... }

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
        round: 0,
        timer: 60,
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
            timer: 60,
            isActive: false
        }
    };

    console.log("Room created : " + roomCode);

    res.send({ roomCode });
});


io.on("connection", (socket) => {
    console.log("[USER CONNECT] A user connected:", socket.id);

    function nextRound(roomCode) {

        if (rooms[roomCode].gameData.round + 1 === getUsernamesInRoom(roomCode).length) {
            console.log("GAME OVER");

            return io.to(roomCode).emit("game-over", { drew: Object.values(users) });
        }


        rooms[roomCode].gameData.timer = 60;
        rooms[roomCode].gameData.round++;
        rooms[roomCode].gameData.drew.push(rooms[roomCode].gameData.currentDrawer);

        rooms[roomCode].gameData.currentDrawer = random(getUsernamesInRoom(roomCode));
        while (rooms[roomCode].gameData.drew.includes(
            rooms[roomCode].gameData.currentDrawer
        )) {
            rooms[roomCode].gameData.currentDrawer = random(getUsernamesInRoom(roomCode)); // Unique drawer generation
        }

        Object.values(users).forEach((user) => {
            user.guessed = false;
        });


        rooms[roomCode].gameData.currentWord = random(JSON.parse(fs.readFileSync("./word-list.json", "utf-8"))["words"]);

        console.log("Game DATA", rooms[roomCode].gameData);

        startTimer();
        io.to(roomCode).emit("round-over", { gameData: rooms[roomCode].gameData, users: Object.values(users) });
    }

    function startTimer() {
        const roomCode = users[socket.id]?.roomCode;

        if (!rooms[roomCode]) return;

        let interval = setInterval(() => {
            if (!rooms[roomCode]) return;


            let guessed = Object.values(users).filter((user) => user.guessed && user.roomCode === roomCode)

            if (guessed.length === getUsernamesInRoom(roomCode).length - 1) {
                console.log("Next round!");
                clearInterval(interval);

                nextRound(roomCode);
                return;
            }



            if (rooms[roomCode].gameData.timer > 0) {
                rooms[roomCode].gameData.timer--;
                io.to(roomCode).emit("timer", rooms[roomCode].gameData.timer);
            } else {



                nextRound(roomCode);
                clearInterval(interval);
            }
        }, 1000);
    }


    socket.on("leave-room", () => {
        console.log("[LEAVE ROOM] User " + JSON.stringify(users[socket.id]));

        const roomCode = users[socket.id].roomCode;

        if (roomCode) {
            const { [socket.id]: _, ...rest } = users;
            users = rest;

            io.to(roomCode).emit("user-left", { users: Object.values(users) });
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

        let color = Math.floor(Math.random() * 5) + 1;

        socket.join(roomCode);
        users[socket.id] = { roomCode, username, guessed: false, score: 0, color };

        console.log(`${socket.id} joined room ${roomCode} with username ${username}`);

        io.to(roomCode).emit("user-joined", {
            username, roomCode, color, score: 0, guessed: false, users: Object.values(users)
                .filter(user => user.roomCode === roomCode)
        });

        if (io.sockets.adapter.rooms.get(roomCode).size >= 2) { // Start the game
            rooms[roomCode].gameData.isActive = true;
            rooms[roomCode].gameData.currentDrawer = random(getUsernamesInRoom(roomCode));
            rooms[roomCode].gameData.currentWord = random(JSON.parse(fs.readFileSync("./word-list.json", "utf-8"))["words"]);

            startTimer();

            io.to(roomCode).emit("game-started", rooms[roomCode].gameData);
            console.log("[GAME START] Game Started: " + JSON.stringify(rooms[roomCode].gameData));
        }
    });

    socket.on("draw", (data) => {
        data["username"] = users[socket.id]?.username;

        const roomCode = users[socket.id].roomCode;
        if (roomCode) {
            io.to(roomCode).emit("draw", data);
        }
    });

    socket.on("drawing-status", (data) => {
        const roomCode = users[socket.id]?.roomCode;
        if (roomCode) {
            io.to(roomCode).emit("drawing-status", data);
        }
    });

    socket.on("chat", (message) => {
        const room = users[socket.id];

        console.log("[Message Recieved] ", message, room);

        if (message.toLowerCase() === rooms[room.roomCode].gameData.currentWord.toLowerCase()) {
            users[socket.id].score += 10;
            users[socket.id].guessed = true;

            io.to(room.roomCode).emit("guessed-word", { username: users[socket.id].username, users: Object.values(users) });
            io.to(room.roomCode).emit("message", { message: "[🎉] Guessed the word! +10 points", username: users[socket.id].username });

            return;
        }

        if (room) {
            io.to(room.roomCode).emit("message", { message, username: users[socket.id].username });
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
            const { [socket.id]: _, ...rest } = users;
            users = rest;

            io.to(roomCode).emit("user-left", { users: Object.values(users) });
            socket.leave(roomCode);

            if (!io.sockets.adapter.rooms.get(roomCode)) {
                const { [roomCode]: _, ...rest } = rooms;
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
