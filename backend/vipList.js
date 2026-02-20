const VIPS = [
  "919527393426@c.us",  // mummy
  "919423258147@c.us",   // Sejal 
  "919503748588@c.us",  // Omkar
  "919527311980@c.us",  // Pappa
  "919929005544@c.us", // Sahaj
  "919234610585@c.us"  //Sahil
];

function isVIP(number) {
  return VIPS.includes(number);
}

module.exports = { isVIP };