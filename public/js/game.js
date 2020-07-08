document.addEventListener('DOMContentLoaded', (event) => {
    gameMain()
    useSocket()
});

let row = 16;
let col = 16;

function gameMain() {
    var board = document.querySelector('.chess-board');
    drawBoard(row, col);
    function drawBoard(row, col) {
        for (var i = 1; i <= row; i++) {
            board.innerHTML += `<div class="row row${i}"></div>`
            for (var j = 1; j <= col; j++) {
                var curRow = document.querySelector(`.row${i}`);
                curRow.innerHTML += `<div class="box _${i}${j}" data-row="${i}" data-col="${j}"></div>`;
            }
        }
    }
}

function useSocket() {

    var socket = io();

    socket.on('user-connect', function (data) {
        document.querySelector('.user-online ul').innerHTML = ''
        data.users.map(function (item) {            
            if (item.status == 'online') {
                document.querySelector('.user-online ul').innerHTML += `<li>${item.name}</li>`
            }
        })
        document.querySelector('.chat-box').innerHTML = ''
        data.chat.map(function (item) {
            document.querySelector('.chat-box').innerHTML += `<p class="chat-line"><b class="chat-user">${item.name}</b><span>: ${item.message}</span></p>`
        })
        if (document.cookie !== '') {
            socket.emit('client-sent-cookie', {
                cookie: document.cookie.slice(3),
                name: document.querySelector('h3 span').innerHTML,
            })
        }
    })

    socket.on('refresh-list', function (data) {
        document.querySelector('.user-online ul').innerHTML = ''
        data.map(function (item) {            
            if (item.status == 'online') {
                document.querySelector('.user-online ul').innerHTML += `<li>${item.name}</li>`
            }
        })
    })


    socket.on('user-logout', function (data) {
        window.location = '/'
    })

    document.querySelector('.logout button').addEventListener('click', function () {
        window.location = '/logout'
    })

    document.querySelector('.chat-form input').addEventListener('keyup', function (event) {
        if (event.keyCode === 13) {
            sendMessageAndDisplay()
        }
    })

    document.querySelector('.chat-form button').addEventListener('click', sendMessageAndDisplay)

    function sendMessageAndDisplay() {
        var regexStr = /^\s*$/g
        var validate = regexStr.test(document.querySelector('.chat-form input').value)
        if (validate) {
            document.querySelector('.chat-form input').value = ''
            return false
        }

        socket.emit('user-send-message', {
            cookie: document.cookie.slice(3),
            name: document.querySelector('h3 span').innerHTML,
            message: document.querySelector('.chat-form input').value
        })

        socket.on('chat-update', function (data) {
            document.querySelector('.chat-box').innerHTML = ''
            data.map(function (item) {
                document.querySelector('.chat-box').innerHTML += `<p class="chat-line"><b class="chat-user">${item.name}</b><span>: ${item.message}</span></p>`
            })
        })

        document.querySelector('.chat-form input').value = ''
    }

    document.querySelector('.game-start button').addEventListener('click', PairPlayer)
    document.querySelector('.game-start input').addEventListener('keyup', function (event) {
        if (event.keyCode === 13) {
            PairPlayer()
        }
    })

    function PairPlayer() {
        var regexStr = /^\s*$/g
        var validate = regexStr.test(document.querySelector('.game-start input').value)
        if (validate) {
            document.querySelector('.game-start input').value = ''
            return false
        }
        if (document.querySelector('.game-start input').value == document.querySelector('h3 span').innerHTML) {
            alert('Bạn không thể chơi với chính mình!')
            return false
        }
        socket.emit('pair-player', {
            cookie: document.cookie.slice(3),
            toUser: document.querySelector('.game-start input').value
        })
    }

    socket.on('invite', function (data) {
        if (window.confirm(`${data.player1.name} muốn chơi caro với bạn!`)) {
            data.row = row;
            data.col = col;
            socket.emit('player-accept', data)
        } else {
            console.log('User not accept');
        }
    })

    socket.on('game-start', function (data) {
        Array.from(document.querySelectorAll('.box')).map(function (item) {
            item.innerHTML = ''
            item.classList.remove('green')
            item.classList.remove('blue')
        })
        alert('Trò chơi bắt đầu!')
    })

    socket.on('first-turn', function (data) {
        alert('Bạn đi đầu tiên')
        Array.from(document.querySelectorAll('.box')).map(function (item) {
            item.onclick = function (event) {
                let row = this.dataset.row;
                let col = this.dataset.col
                data.index = {
                    row,
                    col
                }
                this.innerHTML = '<Span>O</Span>'
                this.classList.add('blue')
                data.player1Turn = !data.player1Turn
                socket.emit('next-turn', data)
                offClick()
            }
        })
    })
    
    socket.on('second-turn', function (data) {
        alert('Bạn đi thứ hai')
    })

    socket.on('your-turn', function (data) {
        if (!data.player1Turn) {
            document.querySelector(`._${data.index.row}${data.index.col}`).innerHTML = 'O'
            document.querySelector(`._${data.index.row}${data.index.col}`).classList.add('blue')
        } else {
            document.querySelector(`._${data.index.row}${data.index.col}`).innerHTML = 'X'
            document.querySelector(`._${data.index.row}${data.index.col}`).classList.add('green')
        }

        Array.from(document.querySelectorAll('.box')).map(function (item) {
            item.onclick = function (event) {
                if (data.player1Turn) {
                    this.innerHTML = '<Span>O</Span>'
                    this.classList.add('blue')
                } else {
                    this.innerHTML = '<Span>X</Span>'
                    this.classList.add('green')
                }
                let row = this.dataset.row;
                let col = this.dataset.col
                data.index = {
                    row,
                    col
                }
                data.player1Turn = !data.player1Turn
                socket.emit('next-turn', data)
                offClick()
            }
        })
    })

    socket.on('you-win', function (data) {
        alert('Bạn đã chiến thắng! :)')
        offClick()
    })
    socket.on('you-lose', function (data) {
        if (!data.player1Turn) {
            document.querySelector(`._${data.index.row}${data.index.col}`).innerHTML = 'O'
            document.querySelector(`._${data.index.row}${data.index.col}`).classList.add('blue')
        } else {
            document.querySelector(`._${data.index.row}${data.index.col}`).innerHTML = 'X'
            document.querySelector(`._${data.index.row}${data.index.col}`).classList.add('green')
        }
        setTimeout(function () {
            alert('Bạn thua mất rồi! :(')
        }, 0)
        offClick()
    })

    function offClick() {
        Array.from(document.querySelectorAll('.box')).map(function (item) {
            item.onclick = function (event) {
                return false
            }
        })
    }

}

