const AWS = require("aws-sdk")
const { assert } = require("console")
const REGION = "ap-southeast-1"
const REGIONTEST = 'us-west-2'
const PROJECT_NAME = 'Automation Test'
const APP_USER = 'user.apk'
const TEST_PACKAGE = 'test-package.zip'
const APP_PHARMACY = 'pharmacy.apk'
const DEVICE_POOL_NAME = 'Android10'
const DEFAULT_YAML = 'Default TestSpec for Android Appium Java TestNG v3.0'

// const ACCESS_KEY = "None";
// const SECRET_KEY = "None";

AWS.config = new AWS.Config();
AWS.config.credentials = new AWS.Credentials(process.env.ACCESS_KEY, process.env.SECRET_KEY);

let codebuild = new AWS.CodeBuild({ region: REGION })
var devicefarm = new AWS.DeviceFarm({ region: REGIONTEST });

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
                console.log(data.uploads.filter(function (upload) {
                    return upload.name === name
                }))
                var uploadArn = data.uploads.filter(function (upload) {
                    return upload.name === name
                })[0].arn
                console.log(uploadArn)
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

function _poll_until_run_done(run_arn) {
    return new Promise((resolve, reject) => {
        devicefarm.getRun({arn: run_arn}, function (err, data) {
            if (err) {
                reject(err)
            } else {
                if (data.run.status === 'PENDING' || data.run.status === 'RUNNING' || data.run.status === 'SCHEDULING') {
                    console.log('Current status: ' + data.run.status)
                    setTimeout(function () {
                        _poll_until_run_done(run_arn)
                    }, 5000)
                } else {
                    console.log(data)
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

    var run_data = await _poll_until_run_done(run_arn);
    if(run_data.result !== "PASSED") process.exit(1)

}



/* Utils */
const Utils = {
    assert: require("assert"),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    test: async () => {
        console.log("hi")
        await Utils.sleep(2000)
        console.log("hi")
        Utils.assert(true)
        // Utils.assert(false)
    },
    logBuild: (build) => {
        const { id, buildStatus, buildComplete, startTime, endTime, artifacts } = build
        console.log({ id, buildStatus, buildComplete, startTime, endTime, artifacts })
    },
}

function listProjects() {
    return new Promise((resolve, reject) => {
        codebuild.listProjects((err, data) => {
            if (err) reject(err)
            else resolve(data.projects)
        })
    })
}

async function getBuild(buildId) {
    let builds = await _batchGetBuilds([buildId])
    return builds[0]
}

function _batchGetBuilds(idList) {
    let param = {
        ids: idList,
    }
    return new Promise((resolve, reject) => {
        codebuild.batchGetBuilds(param, (err, data) => {
            if (err) reject(err)
            else resolve(data.builds)
        })
    })
}

function startBuild(projectName) {
    listProjects().then((projects) => {
        if (!projects.includes(projectName)) {
            throw Exception("No such projectName: " + projectName)
        }
    })

    let param = {
        projectName: projectName,
    }
    return new Promise((resolve, reject) => {
        codebuild.startBuild(param, (err, data) => {
            if (err) reject(err)
            else resolve(data.build)
        })
    })
}

async function poll_until_build_success(buildId, timeOutSeconds = 100) {
    let buildSucceeded = false
    let counter = 0
    while (counter < timeOutSeconds) {
        const { buildStatus } = await getBuild(buildId)
        console.log({ buildStatus })
        if (buildStatus == "SUCCEEDED") {
            return
        } else if (["FAILED", "FAULT", "STOPPED", "TIMED_OUT"].includes(buildStatus)) {
            throw Exception("Test failed")
        }
        counter += 60
        await Utils.sleep(60000)
    }
    throw Exception("Timeout")
}

async function execute() {
    const USER_PROJECT = "dev-user"
    const PHARMACY_PROJECT = "dev-pharmacy"
    // let projectName = process.env.projectName || FALLBACK_PROJECT
    let projectName = process.env.projectName
    if (projectName != "both") {
        const buildId = (await startBuild(projectName)).id
        console.log({ projectName })
        console.log({ buildId })
        try {
            await poll_until_build_success(buildId, 60 * 10)
            Utils.logBuild(await getBuild(buildId))
        } catch (e) {
            console.error(e)
            Utils.assert(false, "Build failed")
        }
    }
    else{
        const buildId1 = (await startBuild(USER_PROJECT)).id
        console.log({ buildId1 })
        try {
            await poll_until_build_success(buildId1, 60 * 10)
            Utils.logBuild(await getBuild(buildId1))
        } catch (e) {
            console.error(e)
            Utils.assert(false, "Build failed")
        }

        const buildId2 = (await startBuild(PHARMACY_PROJECT)).id
        console.log({ buildId2 })
        try {
            await poll_until_build_success(buildId2, 60 * 10)
            Utils.logBuild(await getBuild(buildId2))
        } catch (e) {
            console.error(e)
            Utils.assert(false, "Build failed")
        }
    }
    test()

}

execute().catch(console.error)
