// Example express application adding the parse-server module to expose Parse
// compatible API routes.
require('newrelic');

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
//app.use(cors());
app.use(
  cors(
    { credentials: true, 
      origin: 'localhost:9000';
    }
  )
);

//Set JADE
app.set('view engine', 'jade');

//Set body-parser
app.use( bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

/*app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:9000");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});*/

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send(parseServerHomeBody);
});

// Send a message to the specified email address when you navigate to /submit/someaddr@email.com
// The index redirects here
app.post('/confirmationEmail', function(req,res) {

    //We pass the api_key and domain to the wrapper, or it won't be able to identify + send emails
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});

    var data = {
      //Specify email data
      from: from_who,
      //The email to contact
      to: req.body.to,
      bcc: req.body.bcc,
      //Subject and text data  
      subject: req.body.mailSubject,
      html: "<div style='margin-bottom:15px'><img src='https://www.oneclickstore.com/oneonone/mail/mail-logo.png'></div>" +
            "<hr style='display:block;height:2px;background-color:#cb3630;margin-bottom:25px;border:none'>" +
            "<div style='text-align:center;font-size:28px;'><strong>" + req.body.helloLabel + " " + req.body.clientName + "</strong></div>" +
            "<div style='margin-bottom:25px;text-align:center;font-size:28px;'><strong>" + req.body.confirmationLabel + "</strong></div>" +
            "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.codeLabel + "</strong>" + req.body.reservationCode + "</div>" +
            "<div style='margin-bottom:25px;text-align:center;font-size:26px;color:#555555'><strong>" + req.body.paymentMethodLabel + "</strong>" + req.body.paymentMethodMailLabel + "</div>" +
            "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.dateLabel + "</strong>" + req.body.normalizedTime + "</div>" +
            "<div style='text-align:center;font-size:26px;color:#555555'><strong>" + req.body.storeLabel + "</strong>" + req.body.address + "</div>" +
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
        //If there is an error, render the error page
        /*if (err) {
            console.log("got an error: ", err);
            res.render('error', { error : err});*/
            //console.log("got an error: ", err);
        //}
        //Else we can greet    and leave
        //else {
            //Here "submitted.jade" is the view file for this landing page 
            //We pass the variable "email" from the url parameter in an object rendered by Jade
            /*res.render('submitted', { email : to_who });
        }*/
    });

});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
