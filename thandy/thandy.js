importExtension("qt");
importExtension("qt.core");
importExtension("qt.gui");
importExtension("qt.uitools");

var thandy = {
    start: function() {
		    vdebug("Thandy@start");
        this.tab = null;
        this.tab = this.buildGUI();
        this.thandyProcess = new QProcess();
        this.bootstrapUpdateProcess = new QProcess();
        this.ts = new QTextStream(this.thandyProcess);
        this.timer = new QTimer();

        this.load();

        this.timer['timeout()'].connect(this, this.doCheck);
        if(this.chkPeriodicallyCheck.checkState() == Qt.Checked)
            this.timer.start(1*1000*60*this.spnMin.value);
        // this.doCheck();

        this.thandyProcess['readyReadStandardOutput()'].connect(this, this.checkStdin);
        this.thandyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onFinished);

        this.bootstrapUpdateProcess['readyReadStandardOutput()'].connect(this, this.debugStdin);
        this.bootstrapUpdateProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onBootstrapUpdateFinished);

        this.checking = false;
        this.forceDownload = false;
        this.ready_bundles = [];
        this.do_downloads = [];
    },

    load: function() {
        // PreiodicallyCheck = true/false
        // CheckInterval = int (minutes)
        // Download = true/false
        // UpdaterPath = /path/to/updater/binary
        // DataDir = /path/to/updater.conf (without the "updater.conf")
        // BootstrapUpdateCmd = /path/to/ClientCli
        // BootstrapUpdateParams = update,--controller-log-format,--install,/bundleinfo/bootstrapper/
        // VidaliaBundle = "Vidalia Bundle"
        // BootstrapBundle = "Bootstrapper"
        // TorBundle = "Tor"
        // FirefoxBundle = "Firefox"
        // ThpDbRoot = ""
        // ThpInstallRoot = ""
        // RestartCmd = ../rel/path/to/app
        this.chkPeriodicallyCheck.setCheckState((this.tab.getSetting("PeriodicallyCheck", "true") == "true")?Qt.Checked:Qt.Unchecked);
        this.spnMin.value = this.tab.getSetting("CheckInterval", 1);
        this.chkDownload.setCheckState((this.tab.getSetting("Download", "true") == "true")?Qt.Checked:Qt.Unchecked);
        this.updaterPath = this.tab.getSetting("UpdaterPath", "");
        this.dataDir = this.tab.getSetting("DataDir", "");
        this.bootstrapUpdateCmd = this.tab.getSetting("BootstrapUpdateCmd", "");
        this.bootstrapUpdateParams = this.tab.getSetting("BootstrapUpdateParams", "").toString().split(",");
        this.vidaliaBundle = this.tab.getSetting("VidaliaBundle", "Vidalia Bundle");
        this.bootstrapBundle = this.tab.getSetting("BootstrapBundle", "Bootstrap");
        this.torBundle = this.tab.getSetting("TorBundle", "Tor");
        this.firefoxBundle = this.tab.getSetting("FirefoxBundle", "Firefox");
        this.thpDbRoot = this.tab.getSetting("ThpDbRoot", "");
        this.thpInstallRoot = this.tab.getSetting("ThpInstallRoot", "");
        this.restartCmd = this.tab.getSetting("RestartCmd", "");
    },

    save: function() {
        this.tab.saveSetting("PeriodicallyCheck", (this.chkPeriodicallyCheck.checkState()==Qt.Checked)?"true":"false");
        this.tab.saveSetting("Download", (this.chkDownload.checkState()==Qt.Checked)?"true":"false");
        this.tab.saveSetting("CheckInterval", this.spnMin.value);

        if(this.chkPeriodicallyCheck.checkState() == Qt.Checked)
            this.timer.start(1*1000*60*this.spnMin.value);
    },

    doCheck: function() {
        vdebug("Thandy@doCheck");

        // this.forceDownload makes it ignore the user saved setting
        if(this.checking && !this.forceDownload)
            return;

        this.btnCheck.enabled = false;
        this.checking = true;
        this.timer.stop();

        var params = ["--datadir", this.dataDir, "--check"]
        if(!this.forceDownload && this.chkDownload.checkState() != Qt.Checked) {
            params = params.concat(["--no-download"]);
        }

        vdebug("Checking for updates...");
        this.thandyProcess.setReadChannel(QProcess.StandardOutput);
        this.thandyProcess.start(this.updaterPath,
                                 params,
                                 QIODevice.ReadOnly);
    },

    closeAndUpdate: function() {
        vdebug("Thandy@closeAndUpdate");
        var params = ["--datadir", this.dataDir];
        if(this.ready_bundles.indexOf(this.vidaliaBundle) != -1)
            params = params.concat(["--wait", "5", "--restartcmd", "\""+this.restartCmd.replace("$vidalia_dir",QCoreApplication.applicationDirPath())+"\""]);

        // If there's a tbb, then we need to check for firefox
        var running_apps = "";
        var firefox = false;
        var tor = false;
        if(typeof(tbb) == "object") {
            if((tbb.browserProcess.state() != QProcess.NotRunning) &&
               (this.ready_bundles.indexOf(this.firefoxBundle) != -1)) {
                firefox = true;
                running_apps = "Firefox";
            }
        }
        
        if(torControl.isRunning() && (this.ready_bundles.indexOf(this.torBundle) != -1)) {
            tor = true;
            running_apps = running_apps + ", Tor";
        }

        if(this.running_apps.length > 0) {
            var ret = QMessageBox.question(0, "Applications are still running",
                                           "The following applications are still running and have to update: \n" + running_apps + "\nThey need to be stopped. Do you want to proceed?",
                                           QMessageBox.StandardButtons(QMessageBox.Yes, QMessageBox.No));
            if(ret == QMessageBox.Yes) {
                if(firefox)
                    tbb.browserProcess.terminate();
                if(tor)
                    torControl.stop();
            }
        }

        if(this.ready_bundles.indexOf(this.bootstrapBundle) != -1) {
            this.ready_bundles.splice(this.ready_bundles.indexOf(this.bootstrapBundle), 1);
            var e = new QProcessEnvironment();
            e.insert("THP_DB_ROOT", this.thpDbRoot);
            e.insert("THP_INSTALL_ROOT", this.thpInstallRoot);
            this.bootstrapUpdateProcess.setProcessEnvironment(e);
            this.bootstrapUpdateProcess.setReadChannel(QProcess.StandardOutput);
            this.bootstrapUpdateProcess.start(this.bootstrapUpdateCmd,
                                              this.bootstrapUpdateParams,
                                              QIODevice.ReadOnly);
            return
        }


        QProcess.startDetached(this.updaterPath + " " + params.join(" "));
        if(this.ready_bundles.indexOf(this.vidaliaBundle) != -1)
            vidaliaApp.quit();
    },

    onBootstrapUpdateFinished: function(exitCode, exitStatus) {
        vdebug("Thandy@onBootstrapUpdateFinished", exitCode, exitStatus);
        this.doCheck();
    },

    onFinished: function(exitCode, exitStatus) {
        vdebug("Thandy@onFinished");
        for(var i = 0; i<this.ready_bundles.length; i++)
            vdebug(this.ready_bundles[i]);
        if(this.do_downloads.length > 0 && !this.forceDownload)
            this.newDownload(this.do_downloads.toString());
        if(this.ready_bundles.length > 0)
            this.doUpdate(this.ready_bundles.toString());
        this.do_downloads = [];
        this.ready_bundles = [];
        vdebug("Checking is false now");
        this.checking = false;
        this.forceDownload = false;

        if(this.chkPeriodicallyCheck.checkState() == Qt.Checked)
            this.timer.start(1*1000*60*this.spnMin.value);
        this.btnCheck.enabled = false;
    },

    parseInteresting: function(what, what_inside, msg) {
        var parts = msg.split(" ");
        if(parts.length == 0)
            return "";
        
        if(parts[0] == what) {
            parts.shift();
            parts = parts.join(" ");
            var found = false;
            while(!found) {
                found = parts.indexOf("=") != -1;
                if(found) {
                    break;
                } else {
                    continue;
                }
            }
            if(!found)
                return "";
            var name = parts.split("=");
            if(name.length != 2)
                return "";
            if(name[0] == what_inside) {
                found = false;
                bquote = -1;
                equote = -1;
                var i = 0;
                while(!found) {
                    if(i > name[1].length)
                        break;
                    if(name[1].charAt(i) == '\"') {
                        if(bquote == -1) {
                            bquote = i;
                        } else {
                            equote = i;
                            found = true;
                        }
                    }
                    i++;
                }
                if(bquote == -1 || equote == -1)
                    return "";
                else
                    return name[1].substring(bquote+1, equote);
            }
        }
        return "";
    },

    findInteresting: function(msg) {
        // If we don't want to download, inform when there are files
        if(!this.forceDownload && this.chkDownload.checkState() != Qt.Checked) {
            var file = this.parseInteresting("WANTFILE", "FILENAME", msg);
            if(file != "")
                this.do_downloads = this.do_downloads.concat([file]);
        }
        // Ask whether to update things or not
        // If we are ready to update
        var bundle = this.parseInteresting("READY", "BUNDLE", msg);
        if(bundle != "")
            this.ready_bundles = this.ready_bundles.concat([bundle]);
    },
    
    doUpdate: function(name) {
        var ret = QMessageBox.question(0, "Do you want to update these bundles?",
                                       "The following bundles have an uptade: \n" + name + "\nDo you want to proceed?",
                                       QMessageBox.StandardButtons(QMessageBox.Yes, QMessageBox.No));
        if(ret == QMessageBox.Yes) {
            this.closeAndUpdate();
        }
    },

    newDownload: function(name) {
        var ret = QMessageBox.question(0, "Do you want to download these files?",
                                       "The following files need to be downloaded: \n" + name + "\nDo you want to proceed?",
                                       QMessageBox.StandardButtons(QMessageBox.Yes, QMessageBox.No));
        if(ret == QMessageBox.Yes) {
            // ignore the user saved config and download
            this.forceDownload = true;
            this.doCheck();
        }
    },

    debugStdin: function() {
        vdebug("Thandy@debugStdin");
        vdebug(this.boostrapUpdateProcess.readAllStandardOutput());
    },

    checkStdin: function() {
        vdebug("Thandy@checkStdin");
        if(this.forceDownload)
            return;
        var list = this.ts.readAll().split("\n");
        for(i = 0; i<list.length; i++) {
            vdebug(list[i]);
            this.findInteresting(list[i]);
        }
    },

    buildGUI: function() {
        vdebug("Thandy@buildGUI");
        if(this.tab != null)
            return this.tab;

        // Load the GUI file
        this.tab = new VidaliaTab("Thandy Configuration", "Thandy");

        var file = new QFile(pluginPath+"/thandy/thandy.ui");
        var loader = new QUiLoader(this.tab);
        file.open(QIODevice.ReadOnly);
        this.widget = loader.load(file);
        var layout = new QVBoxLayout();
        layout.addWidget(this.widget, 0, Qt.AlignCenter);
        this.tab.setLayout(layout);
        file.close();

        var grpActions = this.widget.children()[findWidget(this.widget, "grpActions")];
        this.btnCheck = grpActions.children()[findWidget(grpActions, "btnCheck")];

        var grpInterval = this.widget.children()[findWidget(this.widget, "grpInterval")];
        this.chkPeriodicallyCheck = grpInterval.children()[findWidget(grpInterval, "chkPeriodicallyCheck")];
        this.spnMin = grpInterval.children()[findWidget(grpInterval, "spnMin")];

        var grpUpdate = this.widget.children()[findWidget(this.widget, "grpUpdate")];
        this.chkDownload = grpUpdate.children()[findWidget(grpUpdate, "chkDownload")];

        this.btnSave = this.widget.children()[findWidget(this.widget, "btnSave")];

        this.chkPeriodicallyCheck['stateChanged(int)'].connect(this, this.onChkPeriodicallyCheck);
        this.btnSave['clicked()'].connect(this, this.save);

        return this.tab;
    },

    onChkPeriodicallyCheck: function(state) {

    },

    stop: function() {
        vdebug("Thandy@stop");
    },

};
