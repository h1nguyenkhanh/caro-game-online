document.addEventListener('DOMContentLoaded', (event) => {
    login()
});


function login() {
    var socket = io();

    document.querySelector('.login-button').addEventListener('click', function () {
        socket.emit('login', document.querySelector('#username').value)
    })

    socket.on('username-exist', function () {
        alert('Tên đã tồn tại!')
    })

    socket.on('username-wrong', function () {
        alert('Tên không được để chống và chứa ký tự đặc biệt!')
    })

    
    socket.on('user-connect', function(){        
        console.log('hayyyy3')
    })
    
    

    socket.on('login-success', function () {
        // window.location = 'game';                
    })
}
