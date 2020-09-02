const net = require("net");
const Buffer = require("buffer").Buffer;
const { getPeers } = require("./tracker");
const message = require("./message");

const onWholeMessage = (socket, callback) => {
  const savedBuf = Buffer.alloc(0);
  let handshake = true;
  socket.on("data", (recvBuf) => {
    const msgLen = () =>
      handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readUInt32BE(0) + 4;
    savedBuf = Buffer.concat([savedBuf, recvBuf]);
    while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
      callback(savedBuf.slice(0, msgLen()));
      savedBuf = savedBuf.slice(msgLen());
      handshake = false;
    }
  });
};

//Utility function to download files from peers
const download = (peer, torrent) => {
  const socket = new net.Socket();
  socket.on("error", console.log);
  socket.connect(peer.port, peer.ip, () => {
    socket.write(message.buildHandshake(torrent));
  });
  onWholeMessage(socket, (msg) => msgHandler(msg, socket));
};

const msgHandler = (msg, socket) => {
  if (isHandshake(msg)) {
    socket.write(message.buildInterested());
  } else {
    const m = message.parse(msg);
    if (m.id === 0) chokeHandler();
    if (m.id === 1) unchokeHandler();
    if (m.id === 4) haveHandler(m.payload);
    if (m.id === 5) bitfieldHandler(m.payload);
    if (m.id === 7) pieceHandler(m.payload);
  }
};

const isHandshake = (msg) => {
  return (
    msg.length === msg.readUInt8(0) + 49 &&
    msg.toString("utf-8", 1) === "BitTorrent Protocol"
  );
};

const downloadFiles = (torrent) => {
  getPeers(torrent, (peers) => {
    peers.forEach(download);
  });
};

module.exports = { downloadFiles };
