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
        this.ts = new QTextStream(this.thandyProcess);
        this.timer = new QTimer();

        this.load();

        this.timer.start(1*1000*60);
        this.timer['timeout()'].connect(this, this.doCheck);
        // this.doCheck();

        this.thandyProcess['readyReadStandardOutput()'].connect(this, this.checkStdin);
        this.thandyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onFinished);

        this.checking = false;
        this.forceDownload = false;
        this.ready_bundles = [];
    },

    load: function() {
        this.chkPeriodicallyCheck.setCheckState((this.tab.getSetting("PeriodicallyCheck", "true") == "true")?Qt.Checked:Qt.Unchecked);
        this.spnMin.value = this.tab.getSetting("CheckInterval", 1);
        this.chkDownload.setCheckState((this.tab.getSetting("Download", "true") == "true")?Qt.Checked:Qt.Unchecked);
        this.updaterPath = this.tab.getSetting("UpdaterPath", "");
        this.dataDir = this.tab.getSetting("DataDir", "");
    },

    save: function() {
        this.tab.saveSetting("PeriodicallyCheck", (this.chkPeriodicallyCheck.checkState()==Qt.Checked)?"true":"false");
        this.tab.saveSetting("Download", (this.chkDownload.checkState()==Qt.Checked)?"true":"false");
        this.tab.saveSetting("CheckInterval", this.spnMin.value);
    },

    doCheck: function() {
        vdebug("Thandy@doCheck");
        if(this.checking)
            return;

        this.checking = true;
        
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
        if(this.ready_bundles.indexOf("Vidalia Bundle"))
            params.concat(["--wait", "5"]);
        vdebug(this.updaterPath, params);
        QProcess.startDetached(this.updaterPath + " " + params.join(" "));
        if(this.ready_bundles.indexOf("Vidalia Bundle"))
            vidaliaApp.quit();
    },

    onFinished: function(exitCode, exitStatus) {
        vdebug("Thandy@onFinished");
        for(var i = 0; i<this.ready_bundles.length; i++)
            vdebug(this.ready_bundles[i]);
        if(this.ready_bundles.length > 0)
            this.doUpdate(this.ready_bundles.toString());
        this.ready_bundles = [];

        this.checking = false;
        this.forceDownload = false;
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
                this.newDownload(file);
        }
        // Ask whether to update things or not
        // If we are ready to update
        var bundle = this.parseInteresting("READY", "BUNDLE", msg);
        if(bundle != "")
            this.ready_bundles = this.ready_bundles.concat([bundle]);
    },
    
    doUpdate: function(name) {
        var ret = QMessageBox.question(0, "Do you want to update this bundle?",
                                   "The following bundles have an uptade: \n" + name + "\nDo you want to proceed?",
                                   QMessageBox.StandardButtons(QMessageBox.Yes, QMessageBox.No));
        if(ret == QMessageBox.Yes) {
            this.closeAndUpdate();
        }
    },

    newDownload: function(name) {
        var ret = QMessageBox.question(0, "Do you want to download this file?",
                                   "The following file needs to be downloaded: \n" + name + "\nDo you want to proceed?",
                                   QMessageBox.StandardButtons(QMessageBox.Yes, QMessageBox.No));
        if(ret == QMessageBox.Yes) {
            this.forceDownload = true;
            this.doCheck();
        }
    },

    checkStdin: function() {
        vdebug("Thandy@checkStdin");
        var list = this.ts.readAll().split("\n");
        for(i = 0; i<list.length; i++) {
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
