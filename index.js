const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Food Waste Sharing App – Sprint 1");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
