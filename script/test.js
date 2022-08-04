const AWS = require("aws-sdk");
const REGION = 'us-west-2'
const PROJECT_NAME = 'Automation Test'
const APP_USER = 'user.apk'
const TEST_PACKAGE = 'test-package.zip'
const APP_PHARMACY = 'pharmacy.apk'
const DEVICE_POOL_NAME = 'Android10'
const DEFAULT_YAML = 'Default TestSpec for Android Appium Java TestNG v3.0'

// const ACCESS_KEY = "None";
// const SECRET_KEY = "None";

// AWS.config = new AWS.Config();
// AWS.config.credentials = new AWS.Credentials(process.env.ACCESS_KEY, process.env.SECRET_KEY);

var devicefarm = new AWS.DeviceFarm({ region: REGION });
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

function get_device_pool_arn(project_arn, name){
    return new Promise((resolve, reject) => {
        devicefarm.listDevicePools({arn: project_arn, type: "PRIVATE"}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                var device_pool_arn = data.devicePools.filter(function (device_pool) {
                    return device_pool.name === name
                })[0].arn
                resolve(device_pool_arn)
            }
        })
    })
}

function get_upload_arn(project_arn,name){
    return new Promise((resolve, reject) => {
        devicefarm.listUploads({arn: project_arn}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                var uploadArn = data.uploads.filter(function (upload) {
                    return upload.name === name
                })[0].arn
                resolve(uploadArn)
            }
        })
    })
}

function get_yaml_arn(project_arn,name){
    return new Promise((resolve, reject) => {
        devicefarm.listUploads({arn: project_arn}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                var uploadArn = data.uploads.filter(function (upload) {
                    return upload.name.includes(name) === true
                })[0].arn
                resolve(uploadArn)
            }
        })
    })
}

function get_run_result(run_arn) {
    return new Promise((resolve, reject) => {
        devicefarm.getRun({arn: run_arn}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

function _poll_until_run_done(run_arn) {
    return new Promise((resolve, reject) => {
        devicefarm.getRun({arn: run_arn}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                if (data.run.status !== 'COMPLETED') {
                    console.log('Current status: ' + data.run.status)
                    setTimeout(function () {
                        _poll_until_run_done(run_arn)
                    }, 5000)
                } else {
                    console.log('Current status: ' + data.run.status)
                    console.log('Current result: ' + data.run.result)
                    if (data.run.result !== 'PASSED') process.exit(1)
                    resolve(data)
                }
            }
        })
    })
}



function schedule_run(project_arn, name, device_pool_arn, app_arn, test_package_arn, auxiliary_apps, yaml){
    return new Promise((resolve, reject) => {
        devicefarm.scheduleRun({
            projectArn: project_arn,
            name: name,
            devicePoolArn: device_pool_arn,
            appArn: app_arn,
            test: {
                type: "APPIUM_JAVA_TESTNG",
                testPackageArn: test_package_arn,
                testSpecArn: yaml,
            },
            configuration: {
                auxiliaryApps: [auxiliary_apps,],
            }

        }, function (err, data) {
            if (err) {
                reject(err)
            } else {
                resolve(data.run.arn)
            }
        })
    })
}


async function test() {
    var project_arn = await get_project_arn(PROJECT_NAME);
    var device_pool_arn = await get_device_pool_arn(project_arn, DEVICE_POOL_NAME);
    var app_arn = await get_upload_arn(project_arn, APP_USER);
    var test_package_arn = await get_upload_arn(project_arn, TEST_PACKAGE);
    var app2_arn = await get_upload_arn(project_arn, APP_PHARMACY);
    var yaml_arn = await get_yaml_arn(project_arn, DEFAULT_YAML);

    var run_arn = await schedule_run(
        project_arn,
        name='Test Run',
        device_pool_arn=device_pool_arn,
        app_arn=app_arn,
        test_package_arn=test_package_arn,
        auxiliary_apps = app2_arn,
        yaml = yaml_arn,
    );

    await _poll_until_run_done(run_arn)
    var run_data = await get_run_result(run_arn)
    console.log(run_data);
    console.log('1');

}

test()
