// Example express application adding the parse-server module to expose Parse
// compatible API routes.
require('newrelic');

var Parse = require('parse/node');
Parse.initialize(process.env.APP_ID, null, process.env.MASTER_KEY);
Parse.serverURL = process.env.SERVER_URL || 'http://localhost:1337/parse';

var MP = require ("mercadopago");
var mp = new MP (process.env.MERCADOPAGO_CLIENT_ID, process.env.MERCADOPAGO_CLIENT_SECRET);

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
const resolve = require('path').resolve;

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

var invalidLinkTemplateUrl = process.env.INVALID_LINK_TEMPLATE_URL || '';
var verifyEmailSuccessTemplateUrl = process.env.VERIFY_EMAIL_SUCCESS_TEMPLATE_URL || '';
var choosePasswordTemplateUrl = process.env.CHOOSE_PASSWORD_TEMPLATE_URL || '';
var passwordResetSuccessTemplateUrl = process.env.PASSWORD_RESET_SUCCESS_TEMPLATE_URL || '';

var parseServerHomeBody = process.env.PARSE_SERVER_HOME_BODY || '';

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  appName: process.env.APP_NAME || '',
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || '', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  publicServerURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  },
  customPages: {
    invalidLink: invalidLinkTemplateUrl,
    verifyEmailSuccess: verifyEmailSuccessTemplateUrl,
    choosePassword: choosePasswordTemplateUrl,
    passwordResetSuccess: passwordResetSuccessTemplateUrl
  }

});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var cors = require('cors');
var Mailgun = require('mailgun-js');
var app = express();
var bodyParser = require('body-parser')

var api_key = process.env.MAILGUN_API_KEY;
var domain = process.env.MAILGUN_DOMAIN;
var from_who = process.env.MAILGUN_EMAIL_FROM;

//Enable cors
app.use(
  cors(
    { credentials: true, 
      origin: ['http://localhost:9000', 'https://www.oneclickstore.com', 'http://www.oneclick.com.ar'],
      allowedHeaders: 'Origin,Content-Type,Authorization'
      //origin: 'http://localhost:9000'
    }
  )
);

//Set JADE
app.set('view engine', 'jade');

//Set body-parser
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send(parseServerHomeBody);
});

// Send a message to the specified email address when you navigate to /submit/someaddr@email.com
// The index redirects here
app.post('/confirmationEmail', function(req,res) {
    sendConfirmationEmail(req, res);
});

app.post('/surveyEmail', function(req,res) {

    //We pass the api_key and domain to the wrapper, or it won't be able to identify + send emails
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});
    var fromLabel = req.body.fromLabel + ' <' + from_who + '>';
    var surveyLink = process.env.SURVEY_HOST + req.body.surveyLink;

    var data = {
      from: fromLabel,
      to: req.body.to,
      subject: req.body.subject,
      html: "<div style='margin-bottom:15px'><img src='https://www.oneclickstore.com/oneonone/mail/mail-logo.png'></div>" +
            "<hr style='display:block;height:2px;background-color:#cb3630;margin-bottom:25px;border:none'>" +
            "<div style='text-align:center;font-size:20px;'><strong>" + req.body.mailBody + "</strong></div>" +
            "<div style='text-align:center;font-size:20px;'><a href='" + surveyLink + "'>" + req.body.mailSurveyLabel + "</a></div>" +
            "<hr style='display:block;height:2px;background-color:#cb3630;margin-top:25px;border:none'>"
    }

    //Invokes the method to send emails given the above data with the helper library
    mailgun.messages().send(data, function (err, body) {
        if (err) {

        } else {
          res.status(200).send("Mail sent successfully");
        }
    });

});

app.post('/getPaymentConfirmation', function(req,res) {

  var externalReferenceValue = "appointment" + req.body.reservationId;
  var filters = {
    "external_reference": externalReferenceValue
  };

  mp.searchPayment(filters)
    .then (
      function success (data) {

        console.log(JSON.stringify (data, null, 4));

        if (data.response.results.length !== 0) {
          for (var i = 0; i < data.response.results.length; i++) {
            if (data.response.results[i].collection.status === "approved") {
                setReservationUnavailable(req.body.reservationId).then(function() {
                sendConfirmationEmail(req, res);  
              }); 
            }
          }
        }
        /*if (data.response.results.length !== 0 && data.response.results[0].collection.status === "approved") {
            setReservationUnavailable(req.body.reservationId).then(function() {
            sendConfirmationEmail(req, res);  
          });
        }*/
        //res.status(200).send("Payment approved");
      },
      function error (err) {
        console.log (err);
      });

  res.status(200).send("OK");
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);

var setReservationUnavailable = function(reservationId) {
  var Reservation = Parse.Object.extend("Reservation");
  var Store = Parse.Object.extend("Store");
  var reservation = new Reservation();
  var reservationQuery = new Parse.Query(Reservation);
  var storeQuery = new Parse.Query(Store);

  reservationQuery.equalTo("objectId", reservationId);
  reservationQuery.include("reservationStore");

  return reservationQuery.find({useMasterKey:true}).then(function(selectedReservation) {
    storeQuery.equalTo("objectId", selectedReservation[0].attributes.reservationStore.id);

    return storeQuery.find({useMasterKey:true}).then(function(selectedStore) {
      selectedReservation[0].set("available", false);
      selectedReservation[0].set("reservationStore", selectedStore[0]);

      return selectedReservation[0].save({useMasterKey:true}).then(function(updateReservation) {
        return updateReservation;
      }, function(error) {
        
      });

    });      
  });
}

var sendConfirmationEmail = function(req, res) {
  //We pass the api_key and domain to the wrapper, or it won't be able to identify + send emails
  var mailgun = new Mailgun({apiKey: api_key, domain: domain});
  var fromLabel = req.body.fromLabel + ' <' + from_who + '>';

  var data = {
    from: fromLabel,
    to: req.body.to,
    bcc: req.body.bcc,
    subject: req.body.subject,
    html: "<div style='margin-bottom:15px'><img src='https://www.oneclickstore.com/oneonone/mail/mail-logo.png'></div>" +
          "<hr style='display:block;height:2px;background-color:#cb3630;margin-bottom:25px;border:none'>" +
          "<div style='text-align:center;font-size:28px;'><strong>" + req.body.helloLabel + " " + req.body.clientName + "</strong></div>" +
          "<div style='margin-bottom:25px;text-align:center;font-size:28px;'><strong>" + req.body.confirmationLabel + "</strong></div>" +
          "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.codeLabel + "</strong>" + req.body.reservationCode + "</div>" +
          "<div style='margin-bottom:25px;text-align:center;font-size:26px;color:#555555'><strong>" + req.body.paymentMethodLabel + "</strong>" + req.body.paymentMethodMailLabel + "</div>" +
          "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.clientPhoneLabel + "</strong>" + req.body.clientPhone + "</div>" +
          "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.fromDateLabel + "</strong>" + req.body.fromNormalizedTime + "</div>" +
          "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.toDateLabel + "</strong>" + req.body.toNormalizedTime + "</div>" +
          "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.storeLabel + "</strong>" + req.body.storeAddress + "</div>" +
          "<div style='margin-bottom:25px;text-align:center;font-size:26px;color:#555555'><strong>" + req.body.phoneLabel + "</strong>" + req.body.storePhone + "</div>" +
          "<div style='margin-top:10px;text-align:center;font-size:16px;'><strong>" + req.body.paymentOnSite + "</strong></div>" +
          "<div style='margin-top:10px;text-align:center;font-size:16px;'><strong>" + req.body.footerLabel + "</strong></div>" +
          "<hr style='display:block;height:2px;background-color:#cb3630;margin-top:25px;border:none'>"
  }

  //Invokes the method to send emails given the above data with the helper library
  mailgun.messages().send(data, function (err, body) {
      if (err) {

      } else {
        res.status(200).send("Mail sent successfully");
      }
  });
}
