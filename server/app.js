const app         = require('express')()
const fs          = require('fs')
const config      = require('./config')

const getOptions = () => {
    return config.https 
        ? {
            key: fs.readFileSync(config.ssl.key, 'utf8'),
            cert: fs.readFileSync(config.ssl.cert, 'utf8')
        }
        : {}
}

const options     = getOptions()

const server      = require(config.https ? 'https' : 'http').createServer(options, app)
const Redis       = require('redis')
const RedisClient = Redis.createClient()
const io          = require('socket.io')(server)
const axios       = require('axios')

server.listen(8443);

const domain = 'https://treasure-casino.live';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// app
let ipsConnected = []; // подключенные ip
let history = []; // история игр

RedisClient.psubscribe('*');
RedisClient.on('pmessage', async (pattern, channel, message) => {
    if(channel == 'setNewBotTimer') {
        clearInterval(interval);
        interval = null;
        timerBot = message;

        startBot();
    }

    if(channel == 'newGame') {

        if(history.length >= 15) {
            history.pop()
        }

        let game = JSON.parse(message)
        let data = [
            {
                id: 1,
                ico: game.type,
                icoText: capitalizeFirstLetter(game.type)
            },
            {
                id: 2,
                user: game.user
            },
            {
                id: 3,
                value: game.time
            },
            {
                id: 4,
                value: parseFloat(game.amount).toFixed(2)
            },
            {
                id: 5,
                value: parseFloat(game.result).toFixed(2) || 0
            },
        ]

        history.unshift({
            item: data
        })
        return io.sockets.emit('newGame', data)
    }

    io.sockets.emit(channel, JSON.parse(message))
})

io.on('connection', (socket) => {
    const updateOnline = () => {
        io.sockets.emit('online', Object.keys(io.sockets.adapter.rooms).length + 0);
    };

    socket.on('disconnect', () => {
        updateOnline();
    });

    socket.on('getOnline', () => {
        socket.emit('online', Object.keys(io.sockets.adapter.rooms).length + 0);
    })

    socket.on('getGamesHistory', () => {
        socket.emit('gamesHistory', history)
    })

    socket.on('getWheelState', () => {
        if(wheelState.active) {
            socket.emit('wheelSpin', { 
                color: wheelState.color, 
                position: wheelState.position, 
                timer: wheelState.timer 
            })
        }
    })

    updateOnline();
})


function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// wheel

let wheelState = {
    color: null,
    position: null,
    timer: null,
    active: false,
};

const startWheelTimer = () => {
    let seconds = 20;
    const interval = setInterval(() => {
        seconds -= 1;
        wheelState.timer = seconds

        if(seconds <= 0) {
            clearInterval(interval)
            return showWheelSlider()
        }

        io.sockets.emit('wheelTimer', { seconds })
    }, 1000)
}

const addWheelColor = (color) => {
    io.sockets.emit('wheelHistory', { color })
}

const showWheelSlider = () => {
    axios.post(`${domain}/api/wheel/slider`)
    .then(
        function(response) {
            const {data} = response
            color = data.color
            position = data.position

            wheelState.color = color
            wheelState.position = position
            wheelState.active = true

            io.sockets.emit('wheelSpin', { color, position, timer: 10 })

            let seconds = 10;

            const interval = setInterval(() => {
                seconds -= 1;
                wheelState.timer = seconds
        
                if(seconds <= 0) {
                    clearInterval(interval)
                    createWheelGame()
                }
            }, 1000)
        },
        function(response) {
            console.log('[WHEEL] Error showWheelSlider')
            setTimeout(showWheelSlider, 1500)
        }
    )
}

const createWheelGame = (push = true) => {
    axios.post(`${domain}/api/wheel/create`)
    .then(
        function(response) {
            wheelState.bets = []
            wheelState.active = false
            startWheelTimer()

            if(push) {
                addWheelColor(color)
            }
        },
        function(response) {
            console.log('[WHEEL] Error createWheelGame')
            setTimeout(createWheelGame, 1500)
        }
    )
}

const initWheel = () => {
    axios.post(`${domain}/api/wheel/getStatus`)
    .then(
        function(response) {
            const {data} = response

            switch(data.status) {
                
                case '1':
                    startWheelTimer()
                break;
                case '2':
                    addWheelColor(data.color)
                    createWheelGame(false)
                break;
            }

        },
        function(response) {
            console.log('[WHEEL] Error initWheel')
            setTimeout(initWheel, 1500)
        }
    )
}

const startBot = () => {
    interval = setInterval(() => {
        axios.post(`${domain}/api/fake`)
            .then(res => {

            })
            .catch(err => {})
    }, timerBot);
};

const getTimer = () => {
    axios.post(`${domain}/api/getTimer`)
        .then(res => {
            timerBot = res.data;
            startBot();
        })
        .catch(err => {console.log(err)})
};

getTimer()
initWheel()