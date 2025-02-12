const http = require("http");
const url = require("url");
const fs = require("fs");
const messages = require("./lang/messages/en/user.json");

// Handles the file operations.
// It reads a file via read method and if it missing, creat the file with an empty array.
class FileHandler {
  static read(path) {
    return fs.existsSync(path)
      ? fs.readFileSync(path, "utf8")
      : (this.write(path, "[]"), "[]");
  }

  // Write in the file.
  // The write operation blocks execution until it is done writing so that the dictionary updates immediately after adding a word.
  static write(path, data) {
    fs.writeFileSync(path, data);
  }
}

class Server {
  constructor(port, dictionaryFilePath) {
    this.port = port;
    // Create a server
    this.server = http.createServer(this.handleRequest.bind(this));
    this.dictionaryFilePath = dictionaryFilePath;
    this.dictionary = JSON.parse(FileHandler.read(dictionaryFilePath));
    this.numberOfRequests = 0; // Tracks number of API request.
    this.endpoint = "/api/definitions";
  }

  // Start the http server defined on the port
  start() {
    this.server.listen(this.port, () =>
      console.log(`Server is running on port ${this.port}`)
    );
  }

  // This extracts the pathname and query from the get request
  // Replaces a specific path (/COMP4537/labs/4) to standardize request handling.
  // Enables CORS (Access-Control-Allow-Origin: *) to allow cross-origin requests.
  handleRequest(req, res) {
    const reqUrl = url.parse(req.url, true);
    const { pathname, query } = reqUrl;
    const path = pathname.replace("/COMP4537/labs/4", "");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (path !== this.endpoint && path !== this.endpoint + "/") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(messages.endpointInvalidMsg);
      return;
    }

    this.numberOfRequests++;

    if (req.method === "GET") {
      this.handleGetRequest(res, query);
    } else if (req.method === "POST") {
      this.handlePostRequest(req, res);
    }
  }

  
  handleGetRequest(res, query) {
    const word = query.word;

    // Check if they are requesting a word.
    if (!word) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(messages.getReqInvalidMsg);
      return;
    }

    // Check if the words exist in the dictionary
    const wordExist = this.dictionary.find(
      (definition) => definition.word === word
    );
    if (!wordExist) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      const msg = messages.getWordNotFoundMsg
        .replace("%NUMREQ", this.numberOfRequests)
        .replace("%WORD", word);
      res.end(msg);
      return;
    }

    // If word exhist and no errors, we send a response (definition) to the client.
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(wordExist.definition);
  }

  // Handles the post request
  handlePostRequest(req, res) {
    let body = "";
    // Listens for incoming data from the client and process it in chunks.
    req.on("data", (chunk) => {
      // Receives the chunks and keeps appending the chunk to assemble them.
      // This is crucial because HTTP sends data in streams.
      body += chunk.toString();
      console.log("Received chunk: ", chunk.toString());
    });

    req.on("end", () => {
      console.log("Complete request body: ", body);
      // Extracts word and definition from the form data.
      // Converts the word and definition into key-value pairs using URLSearchParams.
      try {
        const params = new URLSearchParams(body);
        const word = params.get("word");
        const definition = params.get("definition");

        // Make sure that both word and definitions have something
        if (!word || !definition) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          console.error("Error: Missing word or definition");
          res.end(messages.postReqInvalidMsg);
          return;
        }

        // Check if the word already exist.
        if (this.dictionary.find((entry) => entry.word === word)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          const msg = messages.postWordExistsMsg.replace("%WORD", word);
          console.error(`Error: Word '${word}' already exists`);
          res.end(msg);
          return;
        }

        // If the word is not duplicated, add the new { word, definition } object to the dictionary.
        this.dictionary.push({ word, definition });
        // Sorts the dictionary alphabetically to keeps words in alphabetical order for easy lookup.
        this.dictionary.sort((a, b) => a.word.localeCompare(b.word));
        console.log(`Adding word: ${word}, definition: ${definition}`);

        // Converts the dictionary into a formatted JSON string.
        // Writes the updated dictionary to the file.
        FileHandler.write(
          this.dictionaryFilePath,
          JSON.stringify(this.dictionary, null, 2)
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        //  Provides confirmation that the word was successfully added back to the client.
        res.end(
          JSON.stringify({
            numReq: this.numberOfRequests,
            date: new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }),
            totalWords: this.dictionary.length,
            word: word,
            definition: definition,
          })
        );
      // If there is an internal error, we just send the appropriate error message.
      } catch (err) {
        console.error("Error processing POST request: ", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });

    req.on("error", (err) => {
      console.error("Error with incoming request: ", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    });
  }
}

const server = new Server(8080, "./dictionary.json");
server.start();
