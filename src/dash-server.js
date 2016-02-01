import Q from "q";
import Slack from "./slack.js";
import tags from "./tags.js";
import express from "express"
import bodyParser from "body-parser";
import requestretry from "requestretry";
import session from "express-session";
import compression from "compression";
import {
  client_id,
  client_secret,
  redirect_uri,
  team_id,
  bot_token,
  cookie_secret,
  dash_port,
} from "../config";

var api = new Slack(bot_token);

var app = express();

app.use(session({
  secret: cookie_secret,
  resave: false,
  saveUninitialized: true,
}));

app.use(compression());

app.get("/oauth", (req, res) => {
  api.slackApi("oauth.access", {
    client_id: client_id,
    client_secret: client_secret,
    redirect_uri: redirect_uri,
    code: req.query.code
  })
  .then((resp) => {
    req.session.token = resp.access_token;
    res.redirect("/");
  });
});

app.use((req, res, next) => {
  if (!req.session.token) {
    var url = `https://slack.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&state=foo&scope=identify`;
    if (!req.query.noteam) {
      url = `${url}&team=${team_id}`
    }
    res.redirect(url);
  } else {
    next();
  }
})

app.use(express.static(__dirname + "/../public"));

app.use(bodyParser.urlencoded({
  extended: true
}));

app.post("/highlight", (req, res) => {
  return res.send("sup");
  api.slackApi(`users.prefs.set?t=${Date.now()}`, {
    name: "highlight_words",
    token: req.session.token,
    value: req.body.highlights,
    set_active: true,
    _attempts: 1
  })
  .then((resp) => res.send(resp))
  .done()
})

var getPrefs = (token) => {
  return Q.Promise((resolve, reject) => {
    requestretry({
      url: `https://slack.com/api/users.prefs.get?token=${token}`,
      method: "GET",
      maxAttempts: 5,
      retryDelay: 0,
      retryStrategy: requestretry.RetryStrategies.HTTPOrNetworkError
    }, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(body));
      }
    });
  })
}

app.get("/highlights", (req, res) => {
  res.json([]);
  return;
  getPrefs(req.session.token)
  .then()
  .then((resp) => {
    res.json(resp.prefs.highlight_words);
  })
  .done()
});

app.get("/logout", (req, res) => {
  delete req.session.token;
  res.redirect("/");
});

app.listen(dash_port);
