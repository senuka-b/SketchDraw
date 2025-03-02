const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = socketIo(server);

app.use(express.static("../client"));

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("draw", (data) => {
        socket.broadcast.emit("draw", data); 
    });

    socket.on("chat", (message) => {
        io.emit("chat", message); 
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
