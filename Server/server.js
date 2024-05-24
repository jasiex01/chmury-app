const { createServer } = require("http");
const { Server } = require("socket.io");

console.log(process.env.VITE_GLOBAL_IP);
const server_address = "http://" + process.env.VITE_GLOBAL_IP + ":5173"

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: server_address,
});

const allUsers = {};
const allRooms = [];

isValid = false;

const jsonwebtoken = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const jsonWebKeys = [
  {
    "alg": "RS256",
    "e": "AQAB",
    "kid": "iJJsTQX8E/iA29rPwcEx6ZE9wJWw+R3Pg+JHE4KsyeY=",
    "kty": "RSA",
    "n": "1rGr9k7RuTUZBwrAc8wKa5cKtfo3OtQt_yAV9VMRKrryhjW8OmhaOuH1LLR5eEMrNvA2A0MbbRbWoVnRTuiHoXSaqIOtcoRNwrtbjBHTsVoIQBdPKRGpyewBBefeUsSvtpQ5VBTRvjlVGTQe0Q14zmV1fsOKZco7P_wJG2TMYdh5LttsBXOT4huwb8C1ggp976wEFzHAQvx4_qZWHc7EDRsaaycQtGO8kkFPtMdnu0dfiMn5WvxHn2IZ59h7LQ6GX4Gn0XdO25hsvZS7HuYGgZe3QWgV_In7BRrnniSqszH3T7lFRADYC6f2jV7W8jOgIOJ-NRzaErnDXQcmrT212w",
    "use": "sig"
  },
  {
    "alg": "RS256",
    "e": "AQAB",
    "kid": "LY2PwrIidytV9MMCHvIb0drR2WMfZjPrnnfRYDrNaSg=",
    "kty": "RSA",
    "n": "5laHA1mKvl8nn2mmgKGld5UqSAheU1hmPhf9yTriMFWtF6EEozNAAyM4FTNGLmWiS7lllyJ8XyNYoUOcRhkM7ePGD0BPTjalpwKWSuZKDjNGxsAt-n8buQXnOqq22xSHd2TJ59D-P3A-3DtEyIW6kTYJHnV1Sgea95b9viOUgRE8n-7kF9yvcPHof2l7uIM6HOXUI-o-HrZ89teYxSlXEFl6MoAHU-gjGJNEi-UKD21Kde3VPNnWdSYzmPzNrHPlnNVdhUxO4auV5DphuBjGaxIV1SwkEu6IjdtuO92XmPk-LBBzABhZvzq1bIqSXf5HkEMAYvEQyBgFUaRhO6m2cQ",
    "use": "sig"
  }
]

function decodeTokenHeader(token) {
  const [headerEncoded] = token.split('.');
  const buff = new Buffer(headerEncoded, 'base64');
  const text = buff.toString('ascii');
  return JSON.parse(text);
}

function getJsonWebKeyWithKID(kid) {
  for (let jwk of jsonWebKeys) {
      if (jwk.kid === kid) {
          return jwk;
      }
  }
  return null
}

function verifyJsonWebTokenSignature(token, jsonWebKey, clbk) {
  const pem = jwkToPem(jsonWebKey);
  jsonwebtoken.verify(token, pem, {algorithms: ['RS256']}, (err, decodedToken) => clbk(err, decodedToken))
}

function validateToken(token) {
  const header = decodeTokenHeader(token);  // {"kid":"XYZAAAAAAAAAAAAAAA/1A2B3CZ5x6y7MA56Cy+6abc=", "alg": "RS256"}
  const jsonWebKey = getJsonWebKeyWithKID(header.kid);
  verifyJsonWebTokenSignature(token, jsonWebKey, (err, decodedToken) => {
      if (err) {
          console.log(err);
      } else {
          console.log(decodedToken);
          isValid = true;
      }
  })
}

io.on("connection", (socket) => {
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  isValid = false;
  const headers = socket.handshake.headers;

  // Access the token from the headers
  const token = headers.token;

  validateToken(token)

  if (!isValid) {
    socket.disconnect();
    return;
  }

  //console.log("Token:", token);

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let opponentPlayer;

    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      allRooms.push({
        player1: opponentPlayer,
        player2: currentUser,
      });

      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "circle",
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "cross",
      });

      currentUser.socket.on("playerMoveFromClient", (data) => {
        opponentPlayer.socket.emit("playerMoveFromServer", {
          ...data,
        });
      });

      opponentPlayer.socket.on("playerMoveFromClient", (data) => {
        currentUser.socket.emit("playerMoveFromServer", {
          ...data,
        });
      });
    } else {
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;
    currentUser.playing = false;

    for (let index = 0; index < allRooms.length; index++) {
      const { player1, player2 } = allRooms[index];

      if (player1.socket.id === socket.id) {
        player2.socket.emit("opponentLeftMatch");
        break;
      }

      if (player2.socket.id === socket.id) {
        player1.socket.emit("opponentLeftMatch");
        break;
      }
    }
  });
});

httpServer.listen(3000);
