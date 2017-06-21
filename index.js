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

var api_key = process.env.MAILGUN_API_KEY;
var domain = process.env.MAILGUN_DOMAIN;
var from_who = process.env.MAILGUN_EMAIL_FROM;
var to_who = process.env.MAILGUN_EMAIL_TO;

app.use(cors());

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
app.get('/testemail', function(req,res) {

    //We pass the api_key and domain to the wrapper, or it won't be able to identify + send emails
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});

    var data = {
    //Specify email data
      from: from_who,
    //The email to contact
      to: to_who,
    //Subject and text data  
      subject: 'Hello from Mailgun',
      html: 'Hello, This is not a plain-text email, I wanted to test some spicy Mailgun sauce in NodeJS!'
    }

    //Invokes the method to send emails given the above data with the helper library
    mailgun.messages().send(data, function (err, body) {
        //If there is an error, render the error page
        if (err) {
            res.render('error', { error : err});
            console.log("got an error: ", err);
        }
        //Else we can greet    and leave
        else {
            //Here "submitted.jade" is the view file for this landing page 
            //We pass the variable "email" from the url parameter in an object rendered by Jade
            res.render('submitted', { email : to_who });
            console.log(body);
        }
    });

});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
