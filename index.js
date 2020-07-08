const express = require('express');
const app = express();
const port = 3000

app.use(express.static('./public'))

let currentUser = null

//body
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

//pug 
app.set('views', './views')
app.set('view engine', 'pug')


//shortid
var shortid = require('shortid');

//cookie
var cookieParser = require('cookie-parser');
app.use(cookieParser());
let currentCookie = null

//socket io
const server = require('http').Server(app);
const io = require('socket.io')(server);
let userSocket = null

//db
var low = require('lowdb')
var FileSync = require('lowdb/adapters/FileSync')
var adapter = new FileSync('db.json')
var db = low(adapter)
db.defaults({ users: [], chat: [], caro: [] })
    .write()


app.get('/', function (req, res) {
    if (req.cookies.id) {
        res.redirect('/game')
    } else {
        res.render('login')
    }
});

app.post('/', function (req, res) {
    var username = req.body.username;
    var regexStr = /[^A-Za-z0-9\s]|^$/g
    var validate = regexStr.test(username)
    var user = db.get('users')
        .find({ name: username })
        .value()
    if (validate) {
        userSocket.emit('username-wrong')
        res.redirect('/')
    }
    else if (user) {
        userSocket.emit('username-exist')
        res.redirect('/')
    } else {
        var userId = shortid.generate()
        var newUser = {
            id: userId,
            socketId: userSocket.id,
            name: username,
            status: 'online'
        }
        currentCookie = userId
        db.get('users')
            .push(newUser)
            .write()
        res.cookie('id', userId)
        res.redirect('/game')
    }
});

app.get('/game', function (req, res) {
    if (req.cookies.id) {
        let userList = db.get('users')
            .value()
        currentUser = db.get('users')
            .find({ id: req.cookies.id })
            .value()
        if (currentUser) {
            res.render('game', { data: userList, currentUser })
        } else {
            res.clearCookie('id');
            res.redirect('/')
        }
    }
    else res.redirect('/')
});

app.get('/logout', function (req, res) {
    let cookieId = req.cookies.id
    db.get('users')
        .remove({ id: cookieId })
        .write()
    io.sockets.emit('user-connect', db.get('users').value())
    res.clearCookie('id');
    res.redirect('/');
})


io.on('connection', function (socket) {
    console.log('user connected');

    userSocket = socket

    io.sockets.emit('user-connect', {
        users: db.get('users').value(),
        chat: db.get('chat').value()
    })

    socket.on('client-sent-cookie', function (data) {
        db.get('users')
            .find({ id: data.cookie })
            .assign({ socketId: socket.id })
            .write()

        db.get('users')
            .find({ id: data.cookie })
            .assign({ status: 'online' })
            .write()

        var userList = db.get('users').value()

        io.sockets.emit('refresh-list', userList)

        currentCookie = data.cookie
    })


    socket.on('user-send-message', function (data) {
        db.get('chat')
            .push(data)
            .write()
        io.sockets.emit('chat-update', db.get('chat').value())
    })

    socket.on('pair-player', function (data) {
        let currentUser = db.get('users')
            .find({ id: data.cookie })
            .value()
        let toUser = db.get('users')
            .find({ name: data.toUser })
            .value()
        if (toUser) {
            io.to(toUser.socketId).emit('invite', {
                player1: currentUser,
                player2: toUser
            });
        }
    })


    socket.on('player-accept', function (data) {
        let board = new Array();
        for (var i = 1; i <= data.row; i++) {
            board[i] = new Array();
            for (var j = 1; j <= data.col; j++) {
                board[i][j] = 'E';
            }
        }

        if (db.get('caro').find({ gameId: data.gameId }).value()) {
            db.get('caro')
                .find({ gameId: data.gameId })
                .assign({ board: board })
                .write()
        } else {
            let gameId = shortid.generate()
            let caroData = {
                gameId: gameId,
                board: board,
                gameStatus: 'playing'
            }
            data.gameId = gameId
            db.get('caro').push(caroData).write()
        }

        io.to(data.player1.socketId).emit('game-start', data);
        io.to(data.player2.socketId).emit('game-start', data);

        if (Math.random() >= 0.5) {
            data.player1Turn = true
            io.to(data.player1.socketId).emit('first-turn', data);
            io.to(data.player2.socketId).emit('second-turn', data);
        }
        else {
            data.player1Turn = false
            io.to(data.player2.socketId).emit('first-turn', data);
            io.to(data.player1.socketId).emit('second-turn', data);
        }
    })



    socket.on('next-turn', function (data) {
        let currentBoard = db.get('caro')
            .find({ gameId: data.gameId })
            .value().board

        if (!data.player1Turn) {
            currentBoard[data.index.row][data.index.col] = 'O'
        } else {
            currentBoard[data.index.row][data.index.col] = 'X'
        }
        db.get('caro')
            .find({ gameId: data.gameId })
            .assign({ board: currentBoard })
            .write()

        data.board = currentBoard

        let isWin = checkWin(data.board, data.index.row, data.index.row)
        console.log(isWin);


        if (isWin) {
            db.get('caro')
                .remove({ gameId: data.gameId })
                .write()
            if (isWin == 'O') {
                io.to(data.player1.socketId).emit('you-win', data);
                io.to(data.player2.socketId).emit('you-lose', data);
            } else if (isWin == 'X') {
                io.to(data.player2.socketId).emit('you-win', data);
                io.to(data.player1.socketId).emit('you-lose', data);
            } else {

            }
        } else {
            if (!data.player1Turn) {
                io.to(data.player2.socketId).emit('your-turn', data);
            } else {
                io.to(data.player1.socketId).emit('your-turn', data);
            }
        }
    })


    socket.on('disconnect', () => {
        console.log('user disconnect');
        db.get('users')
            .find({ id: currentCookie })
            .assign({ status: 'offline' })
            .write()
        var userList = db.get('users').value()
        io.sockets.emit('refresh-list', userList)
    });

    function checkWin(board, row, col) {
        var valueStr = getValueString(board, row, col);
        if (/XXXXX/.test(valueStr)) {
            return 'X';
        }
        if (/OOOOO/.test(valueStr)) {
            return 'O'
        }
    }


    function getValueString(board, row, col) {
        var valStr = '';
        //Nối các dòng
        for (var i = 1; i <= row; i++) {
            valStr += 'S' + board[i].join('') + 'br';
        }

        //Nối các cột
        for (var j = 1; j <= col; j++) {
            valStr += 'S';
            for (var i = 1; i <= row; i++) {
                valStr += board[i][j];

            }
            valStr += 'br';
        }

        //Nối chéo trên phải
        for (var k = 1; k <= col; k++) {
            valStr += 'S';
            i = 1; j = k;
            while (i <= row && j <= col) {
                valStr += board[i][j];
                i++; j++;
            }
            valStr += 'br';
        }

        //Nối chéo trên trái
        for (var k = 1; k <= col; k++) {
            valStr += 'S';
            i = 1; j = k;
            while (i <= row && j >= 1) {
                valStr += board[i][j];
                i++; j--;
            }
            valStr += 'br';
        }


        //Nối chéo dưới phải
        for (var k = 1; k <= col; k++) {
            valStr += 'S';
            i = row; j = k;
            while (i >= 1 && j <= col) {
                valStr += board[i][j];
                i--; j++;
            }
            valStr += 'br';
        }

        //Nối chéo dưới trái
        for (var k = 1; k <= col; k++) {
            valStr += 'S';
            i = row; j = k;
            while (i >= 1 && j >= 1) {
                valStr += board[i][j];
                i--; j--;
            }
            valStr += 'br';
        }
        return valStr
    }
});

server.listen(port, () => {
    console.log('Server started in host ' + port)
});