const AWS = require("aws-sdk")
const REGION = "us-west-2"
const PROJECT_NAME = "Automation Test"

AWS.config = new AWS.Config()
AWS.config.region = REGION
AWS.config.credentials = new AWS.Credentials(process.env.ACCESS_KEY, process.env.SECRET_KEY);

let devicefarm = new AWS.DeviceFarm()
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'phamnhathoang091@gmail.com',
    pass: 'grtjacpegmkiylcf'
  }
});

var mailOptions = {
  from: 'phamnhathoang091@gmai.com',
  to: 'nhathoangpham1107@gmail.com',
  subject: 'AUTOMATION TEST REPORT',
  text: 'That was easy!'
};


function get_project_arn(name) {
    return new Promise((resolve, reject) => {
        devicefarm.listProjects(function (err, data) {
            if (err) {
                reject(err)
            } else {
                var projectArn = data.projects.filter(function (project) {
                    return project.name === name
                })[0].arn
                resolve(projectArn)
            }
        })
    })
}

function get_project_last_run(project_arn) {
    let params = {
        arn: project_arn,
    }
    return new Promise((resolve, reject) => {
        devicefarm.listRuns(params, function (err, data) {
            if (err) reject(err)
            else resolve(data.runs[0])
        })
    })
}

function list_run_artifacts(run_arn) {
    let params = {
        arn: run_arn,
        type: "FILE", // FILE | SCREENSHOT | LOG
    }
    return new Promise((resolve, reject) => {
        devicefarm.listArtifacts(params, function (err, data) {
            if (err) reject(err)
            else resolve(data.artifacts)
        })
    })
}

async function logFiles(run_arn, type) {
    let files = await list_run_artifacts(run_arn)
    const link = files.filter((f) => f.type == type)
    return link
}

function sendMail() {
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}

async function getLog() {
    let project_arn = await get_project_arn(PROJECT_NAME)
    let run = await get_project_last_run(project_arn)
    var timeCreated = new Date(run.created).toLocaleString(options = { timeZone: 'UTC' })
    var timeStoped = new Date(run.stopped).toLocaleString(options = { timeZone: 'UTC' })

    var linkVideo = await logFiles(run.arn, "url")[0]
    if(!linkVideo) linkVideo = "No video"
    let files = await list_run_artifacts(run.arn)
    var linkLog = await logFiles(run.arn, "TESTSPEC_OUTPUT")[0]
    if(!linkLog) linkLog = "No log"

    var text = "Test run: " + run.name + "\n" + "Time Created: " + timeCreated + "\n" + "Time Stop: " + timeStoped + "\n" +  "Test Status: " + run.status + "\n" + "Test result: " + run.result + "\n" + "Counters :" + "\n\t" + "Passed: " + run.counters.passed + "\n\t" + "Failed: " + run.counters.failed + "\n\t" + "Skipped: " + run.counters.skipped + "\n\t" + "Total: " + run.counters.total + "\n" + "Video link: " + linkVideo + "\n" + files[2].url + "\n" + "Log link: " + linkLog

    mailOptions.text = text
    mailOptions.subject = "AUTOMATION TEST REPORT" + " " + timeCreated + " - " + run.result
    sendMail()
}

getLog().catch(console.error)
