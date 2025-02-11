const http = require("http");
const url = require("url");
const fs = require("fs");
const messages = require("./lang/messages/en/user.json");

class FileHandler {
  static read(path) {
    return fs.existsSync(path)
      ? fs.readFileSync(path, "utf8")
      : (this.write(path, "[]"), "[]");
  }

  static write(path, data) {
    fs.writeFileSync(path, data);
  }
}

class Server {
  constructor(port, dictionaryFilePath) {
    this.port = port;
    this.server = http.createServer(this.handleRequest.bind(this));
    this.dictionaryFilePath = dictionaryFilePath;
    this.dictionary = JSON.parse(FileHandler.read(dictionaryFilePath));
    this.numberOfRequests = 0;
    this.endpoint = "/api/definitions";
  }

  start() {
    this.server.listen(this.port, () =>
      console.log(`Server is running on port ${this.port}`)
    );
  }

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

    if (!word) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(messages.getReqInvalidMsg);
      return;
    }

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

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(wordExist.definition);
  }

  handlePostRequest(req, res) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      console.log("Received chunk: ", chunk.toString());
    });

    req.on("end", () => {
      console.log("Complete request body: ", body);
      try {
        const params = new URLSearchParams(body);
        const word = params.get("word");
        const definition = params.get("definition");

        if (!word || !definition) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          console.error("Error: Missing word or definition");
          res.end(messages.postReqInvalidMsg);
          return;
        }

        if (this.dictionary.find((entry) => entry.word === word)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          const msg = messages.postWordExistsMsg.replace("%WORD", word);
          console.error(`Error: Word '${word}' already exists`);
          res.end(msg);
          return;
        }

        this.dictionary.push({ word, definition });
        this.dictionary.sort((a, b) => a.word.localeCompare(b.word));
        console.log(`Adding word: ${word}, definition: ${definition}`);

        FileHandler.write(
          this.dictionaryFilePath,
          JSON.stringify(this.dictionary, null, 2)
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            numReq: this.numberOfRequests,
            date: new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }),
            totalWords: this.dictionary.length,
            word: word,
            definition: definition,
          })
        );
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
