const express = require("express");
const app = express();
app.use(express.json());
const axios = require("axios");
const mysql = require("mysql");
const sha256 = require("sha256");
require("dotenv").config();
const cors = require("cors");
app.use(cors());


//// send in blue boiler plate
const SibApiV3Sdk = require("sib-api-v3-sdk");
const defaultClient = SibApiV3Sdk.ApiClient.instance;

const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.SENDINBLUEAPI_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

const connection = {};

connection.mysql = mysql.createConnection({
  database: process.env.DATABASE,
  user: process.env.USERNAME,
  password: process.env.PASSWORD,
  host: process.env.HOST,
  port: process.env.MYSQL_PORT,
});

// connection.mysql = mysql.createConnection({
//   database: process.env.FREESQL_DATABASE,
//   user: process.env.FREESQL_USERNAME,
//   password: process.env.FREESQL_PASSWORD,
//   host: process.env.FREESQL_HOST,
//   port: process.env.MYSQL_PORT,
// });

connection.mysql.connect();

const nodePort = process.env.PORT || 6002;

app.get("/email-validate/:email", (request, response) => {
  console.log(request.params.email);
})

app.post("/sign-up", (request, response) => {
  console.log(request.body);

  const hashedPassword = sha256(request.body.password + "travel");

  const emailExistQuery = `SELECT count(*) as count FROM user
                              WHERE email = "${request.body.email}"
                        `;
  connection.mysql.query(emailExistQuery, (error, results) => {
    console.log(results[0].count);
    if (results[0].count === 0) {
      const query = `INSERT INTO user (firstName, lastName, email, hashedPassword)
                  VALUES("${request.body.firstName}",
                    "${request.body.lastName}",
                    "${request.body.email}",
                    "${hashedPassword}")`;
      console.log(query);

      connection.mysql.query(query, (error, results) => {
        sendSmtpEmail.name = "Nomader email verification"
        sendSmtpEmail.sender = { email: 'aaroncedmistondev@gmail.com' };
        sendSmtpEmail.to = [{ name: request.body.firstName, email: request.body.email }];
        sendSmtpEmail.replyTo = { email: 'aaroncedmistondev@gmail.com' };
        sendSmtpEmail.subject = "Dear Nomader, Please verify your email!";
        sendSmtpEmail.htmlContent = `<h1>Hi ${request.body.firstName}!</h1>
                                      <p> Welcome to Nomader!<p>
                                      <p> Please make sure to click the link below to verify your email. </p>
                                      <button><a href="https://nomader.herokuapp.com/login">Click Here!</a></button>
                                      <p> Best, </p>
                                      <p> The Nomader Team </p>
                                      `;

        apiInstance.sendTransacEmail(sendSmtpEmail).then((data) => {
          console.log('Email sent', JSON.stringify(data))
        })
        response.json({ received: true });
      })
    } else {
      response.json({ received: false });
    }
  })
})

app.post("/log-in", (request, response) => {
  console.log(request.body);

  const hashedPassword = sha256(request.body.password + "travel");

  const query = `SELECT id, count(*) as count FROM user
  WHERE email = "${request.body.email}"
  AND hashedPassword = "${hashedPassword}"
    `;
  console.log(query);
  connection.mysql.query(query, (error, results) => {
    if (results[0].count === 1) {
      const token = Math.floor(Math.random() * 10000000000000000);

      const query = `INSERT INTO tokens(id, token) VALUES(${results[0].id}, "${token}")`
      connection.mysql.query(query, (error, request) => {
        console.log('Token stored');
      })
      response.json({ token });

    } else {
      response.send('Wrong password!');
    }
  })
})

app.get("/live-prices", async (request, response) => {
  try {
    console.log('this route is working')
    const results = await axios.post('https://partners.api.skyscanner.net/apiservices/v1.0', {
      cabinclass: 'Economy',
      country: 'UK',
      currency: 'GBP',
      locale: 'en-GB',
      locationSchema: 'iata',
      originplace: 'EDI',
      destinationplace: 'LHR',
      outbounddate: '2021-10-30',
      inbounddate: '2021-11-02',
      adults: 1,
      children: 0,
      infants: 0,


      apikey: process.env.X_RAPIDAPI_KEY
    })
    response.json({ received: true });
  } catch (error) {
    console.log(error)
  }
});

//for the App.js component did mount currencies
app.get("/currencies", async (request, response) => {
  try {
    const options = {
      headers: {
        "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
        "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
      },
    };

    const fetchCurrencies = async () => {
      const { data } = await axios.get(
        "https://skyscanner-skyscanner-flight-search-v1.p.rapidapi.com/apiservices/reference/v1.0/currencies", options
      );
      response.json({ currencies: data.Currencies });
    };
    fetchCurrencies();
  } catch (error) {
    console.log(error);
  }
})

// for Home.jsx flight search airports
app.post("/flight-input", async (request, response) => {
  // console.log(request);
  try {
    const options = {
      url: `https://skyscanner-skyscanner-flight-search-v1.p.rapidapi.com/apiservices/autosuggest/v1.0/${request.body.payload}`,
      params: request.body.params,
      headers: {
        "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
        "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
      },
    };
    let results = await axios.request(options);
    console.log(options);

    response.json(results.data)
  } catch (error) {
    console.log(error);
  }
})

// for Home.jsx onSubmit flight data search
app.post("/submit", async (request, response) => {
  // console.log(request);
  try {
    const options = {
      url: `https://skyscanner-skyscanner-flight-search-v1.p.rapidapi.com/apiservices/browsequotes/v1.0/${request.body.payload}`,
      params: request.body.params,
      headers: {
        "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
        "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
      },
    };
    let results = await axios.request(options);

    response.json(results.data);
  } catch (error) {
    console.log(error)
  }
})

// for the contact sheet receipt
app.post("/contact", async (request, response) => {
  if (response.json({ received: true })) {

    sendSmtpEmail.name = "Contact Form Submission"
    sendSmtpEmail.sender = { email: request.body.email };
    sendSmtpEmail.to = [{ name: 'Nomader Team', email: 'aaroncedmistondev@gmail.com' }];
    sendSmtpEmail.replyTo = { email: request.body.email };
    sendSmtpEmail.subject = "Contact Form Submission from Nomader";
    sendSmtpEmail.htmlContent = `<h1>Hi Nomader Team!</h1>
                                      <p> Please respond to the following contact form submission ASAP.<p>
                                      <p> From: ${request.body.fullName} </p>
                                      <p> Email: ${request.body.email} </p>
                                      <p> Phone: ${request.body.phone} </p>
                                      <p> Subject: ${request.body.subject} </p>
                                      <p> Message: ${request.body.message} </p>
                                      <p> Best, </p>
                                      <p> Management </p>
                                      `;
    apiInstance.sendTransacEmail(sendSmtpEmail).then((data) => {
      console.log('Email sent', JSON.stringify(data))
    })

  } else {
    response.json({ received: false });
    console.log('Service unavailable. Please try again later.');
  }
})



app.listen(nodePort);