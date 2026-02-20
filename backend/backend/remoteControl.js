let remoteEnabled = false;

function enableRemote() {
  remoteEnabled = true;
}

function disableRemote() {
  remoteEnabled = false;
}

function isRemoteEnabled() {
  return remoteEnabled;
}

module.exports = {
  enableRemote,
  disableRemote,
  isRemoteEnabled
};