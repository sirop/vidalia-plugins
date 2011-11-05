importExtension("qt");
importExtension("qt.core");
importExtension("qt.gui");
importExtension("qt.uitools");

var tbb = {
    BrowserExecutable: "BrowserExecutable",
    BrowserDirectory: "BrowserDirectory",
    //  We don't want polipo anymore?
    //  ProxyExecutable: "ProxyExecutable",
    //  RunProxyAtStart: "RunProxyAtStart",
    //  ProxyExecutableArguments: "ProxyExecutableArguments",

    start: function() {
		    vdebug("TBB@start");
        this.tab = new VidaliaTab("Browser Bundle Settings", "TBB"); // We need this to access the settings later
        this.browserProcess = new HelperProcess();
        this.proxyProcess = new HelperProcess();

        this.browserProcess['startFailed(QString)'].connect(this, this.onBrowserFailed);
        this.proxyProcess['startFailed(QString)'].connect(this, this.onProxyFailed);
        this.browserProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onSubProcessFinished);
        this.proxyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onSubProcessFinished);

        this.host = "";
        this.control_port = "";
        this.socks_port = "";

        // Show a popup when tor's started so that users wait for the new
        // Firefox, so that they don't open a firefox themselves and think they
        // are using tor when they are not?
        torControl["authenticated()"].connect(this, this.showWaitDialog);
        torControl["authenticated()"].connect(this, this.startSubProcess);
    },

    buildGUI: function() {
        vdebug("TBB@buildGUI");
        // Load the GUI file
        this.tab = new VidaliaTab("Browser Bundle Settings", "TBB");

        var file = new QFile(pluginPath+"/tbb/tbb.ui");
        var loader = new QUiLoader(this.tab);
        file.open(QIODevice.ReadOnly);
        this.widget = loader.load(file);
        var layout = new QVBoxLayout();
        layout.addWidget(this.widget, 0, Qt.AlignCenter);
        this.tab.setLayout(layout);
        file.close();

        var portInfo = this.widget.children()[findWidget(this.widget, "portInfo")];
        if(portInfo == null) {
            return this.tab;
        }

        var groupBox = this.widget.children()[findWidget(this.widget, "browserBox")];
        if(groupBox == null) {
            return this.tab;
        }

        var closeBox = this.widget.children()[findWidget(this.widget, "closeActionBox")];
        if(groupBox == null) {
            return this.tab;
        }

        this.btnSave = this.widget.children()[findWidget(this.widget, "btnSave")];
        if(this.btnSave != null) {
            this.btnSave["clicked()"].connect(this, this.saveSettings);
        }

        this.btnLaunch = groupBox.children()[findWidget(groupBox, "btnLaunch")];
        if(this.btnLaunch != null) {
            this.btnLaunch["clicked()"].connect(this, this.startSubProcess);
        }

        this.btnExecutable = groupBox.children()[findWidget(groupBox, "btnExecutable")];
        if(this.btnExecutable != null) {
            this.btnExecutable["clicked()"].connect(this, this.showExecDialog);
        }

        this.btnDirectory = groupBox.children()[findWidget(groupBox, "btnDirectory")];
        if(this.btnDirectory != null) {
            this.btnDirectory["clicked()"].connect(this, this.showDirDialog);
        }

        /****************************/

        this.lineExecutable = groupBox.children()[findWidget(groupBox, "lineExecutable")];
        if(this.lineExecutable != null) {
            this.lineExecutable.text = this.tab.getSetting(this.BrowserExecutable, "");
        }
        
        this.lineDirectory = groupBox.children()[findWidget(groupBox, "lineDirectory")];
        if(this.lineDirectory != null) {
            this.lineDirectory.text = this.tab.getSetting(this.BrowserDirectory, "");
        }

        this.chkShowDialog = closeBox.children()[findWidget(closeBox, "chkShowDialog")];
        if(this.chkShowDialog != null) {
            if(this.tab.getSetting("DontShowCloseDialog", "false") != "true")
                this.chkShowDialog.setCheckState(Qt.Checked);
        }

        this.lblHost = portInfo.children()[findWidget(portInfo, "lblHost")];
        this.lblHost.text = this.host;
        this.lblControl = portInfo.children()[findWidget(portInfo, "lblControl")];
        this.lblControl.text = this.control_port;
        this.lblSocks = portInfo.children()[findWidget(portInfo, "lblSocks")];
        this.lblSocks.text = this.socks_port;
        return this.tab;
    },

    saveSettings: function() {
        this.tab.saveSetting(this.BrowserExecutable, this.lineExecutable.text);
        this.tab.saveSetting(this.BrowserDirectory, this.lineDirectory.text);
        this.tab.saveSetting("DontShowCloseDialog", String(this.chkShowDialog.checkState() != Qt.Checked));
    },

    onSubProcessFinished: function(exitCode, exitStatus) {
        vdebug("TBB@onSubProcessFinished");
        var browserExecutable = this.tab.getSetting(this.BrowserExecutable, "").toString();
        var browserDirectory = this.tab.getSetting(this.BrowserDirectory, "").toString();

        var browserDone = (browserExecutable == "" && browserDirectory == "") 
            || this.browserProcess.isDone();

        if (browserDone) {
            vdebug("TBB@BrowserDone");
            if (browserDirectory == "") {
                vdebug("TBB@BrowserDirectory empty");
            }
            var dontshow = this.tab.getSetting("DontShowCloseDialog", "false");
            if(dontshow != "true") { // I hate javascript
	              this.showCloseDialog();
            }
        }

        this.btnLaunch.enabled = true;
    },

    onBrowserFailed: function(msg) {
        vdebug("TBB@onBrowserFailed");
        QMessageBox.warning(0, "Error starting web browser",
                            "Vidalia was unable to start the configured web browser",
                            QMessageBox.Ok);
    },

    onProxyFailed: function(msg) {
        vdebug("TBB@onProxyFailed");
        QMessageBox.warning(0, "Error starting proxy server",
                            "Vidalia was unable to start the configured proxy server",
                            QMessageBox.Ok);
    },

    // Not used right now
    onCheckForBrowser: function() {
        vdebug("TBB@onCheckBrowser");
    },

    stop: function() {
        vdebug("TBB@stop");
        if (this.proxyProcess.state() != QProcess.NotRunning) {
            /* Close the proxy server (Polipo ignores the WM_CLOSE event sent by
             * terminate() so we have to kill() it) */
            this.proxyProcess.kill();
        }
        //  /* Kill the browser and IM client if using the new launcher */
        //  VidaliaSettings vidalia_settings;

        if(this.tab.getSetting(this.BrowserDirectory, "") != "") {
            //    /* Disconnect the finished signals so that we won't try to exit Vidalia again */
            //    QObject::disconnect(_browserProcess, SIGNAL(finished(int, QProcess::ExitStatus)), 0, 0);
            //    QObject::disconnect(_imProcess, SIGNAL(finished(int, QProcess::ExitStatus)), 0, 0);

            /* Use QProcess terminate function */
            if (this.browserProcess.state() == QProcess.Running)
                this.browserProcess.terminate();

            //#if defined(Q_OS_WIN)
            //    /* Kill any processes which might have been forked off */
            //    win32_end_process_by_filename(vidalia_settings.getBrowserExecutable());
            //#endif

            //    if (_imProcess->state() == QProcess::Running)
            //      _imProcess->terminate();    
        }
    },

    launchBrowserFromDirectory: function() {
        vdebug("TBB@launchBrowserFromDirectory");
        var browserDirectoryFilename = this.tab.getSetting(this.BrowserExecutable, "");
        var browserDirectory = this.tab.getSetting(this.BrowserDirectory, "");

        this.browserProcess.setEnvironment(this.updateBrowserEnv());

        var browserExecutable = QDir.toNativeSeparators(browserDirectory + "/App/Firefox/" + 
                                                        browserDirectoryFilename);

        var profileDir = QDir.toNativeSeparators(browserDirectory + "/Data/profile");
        var browserDirObj = new QDir(browserDirectory);

        /* Copy the profile directory if it's not already there */
        if(!browserDirObj.exists("Data/profile")) {
            browserDirObj.mkpath("Data/profile");
            this.copy_dir(browserDirectory + "/App/DefaultData/profile", browserDirectory + "/Data/profile");
        }

        /* Copy the plugins directory if it's not already there */
        if (!browserDirObj.exists("Data/plugins")) {
            browserDirObj.mkpath("Data/plugins");
            this.copy_dir(browserDirectory + "/App/DefaultData/plugins", browserDirectory + "/Data/plugins");
        }

        /* Build the command line arguments */
        /* Is this better or worse than MOZ_NO_REMOTE? */
        var commandLine = "-no-remote ";
        commandLine += "-profile ";
        commandLine += profileDir;

        /* Launch the browser */
        this.browserProcess.start(browserExecutable, commandLine);
        this.browserProcess.toForeground()
    },

    startSubProcess: function() {
        vdebug("TBB@startSubProcess");

        if(!torControl.isConnected())
            return;

        while(!torControl.isCircuitEstablished()) {
            vdebug("Waiting on circuit established");
            sleep(1); // sleep 1s
        }

        var proxyExecutable = this.tab.getSetting(this.ProxyExecutable, "");
        var runAtStart = this.tab.getSetting(this.RunProxyAtStart, "");
        var proxyExecutableArguments = this.tab.getSetting(this.ProxyExecutableArguments, "");

        // if(runAtStart) {
        //     vdebug("TBB@starting proxy");
        //     this.proxyProcess.start(proxyExecutable, proxyExecutableArguments);
        // }

        var browserExecutable = this.tab.getSetting(this.BrowserExecutable, "");
        var browserDirectory = this.tab.getSetting(this.BrowserDirectory, "");

        if(browserDirectory != "") {
            this.launchBrowserFromDirectory();
        } else if(browserExecutable != "") {
            this.browserProcess.setEnvironment(this.updateBrowserEnv());
            this.browserProcess.start(browserExecutable, "-no-remote");
            this.browserProcess.toForeground();
        }

        this.btnLaunch.enabled = false;
    },

    copy_dir: function(source, dest) {
        /* Source and destination as QDir's */
        vdebug("TBB@copy_dir("+source+","+dest+")");
        var src = new QDir(source);
        var dst = new QDir(dest);
        
        /* Get contents of the directory */
        var contents = src.entryInfoList();

        /* Copy each entry in src to dst */
        var fileInfo;
        for(var i=0; i<contents.length; i++) {
            fileInfo = contents[i];
            /* Get absolute path of source and destination */
            var fileName = fileInfo.fileName();
            if(fileName == "." || fileName == "..")
                continue;
            
            var srcFilePath = src.absoluteFilePath(fileName);
            var dstFilePath = dst.absoluteFilePath(fileName);

            if (fileInfo.isDir()) {
                /* This is a directory, make it and recurse */
                if (!dst.mkdir(fileName))
                    return false;
                if (!copy_dir(srcFilePath, dstFilePath))
                    return false;
            } else if (fileInfo.isFile()) {
                /* This is a file, copy it */
                if (!QFile.copy(srcFilePath, dstFilePath))
                    return false;
            } 
            /* Ignore special files (e.g. symlinks, devices) */
        }
        return true;
    },
    
    showDirDialog: function() {
        print("tbb@showDirDialog");
        this.lineDirectory.text = QFileDialog.getExistingDirectory(this, "Choose a directory...", "/", QFileDialog.ShowDirsOnly);
    },

    showExecDialog: function() {
        vdebug("tbb@showExecDialog");
        this.lineExecutable.text = QFileDialog.getOpenFileName(this, "Choose a directory...", "/");
    },

    showWaitDialog: function() {
        if(QSystemTrayIcon.supportsMessages()) {
			      var tray = new QSystemTrayIcon();
			      tray.show();
            tray.showMessage("Remember", 
                             "Please wait a few seconds, a Tor enabled Firefox will start right away...", 
                             QSystemTrayIcon.Warning, 40000);
        } else
            vdebug("Doesn't support messages!");
    },

    showCloseDialog: function() {
        var file = new QFile(pluginPath+"/tbb/reopen.ui");
        var loader = new QUiLoader();
        file.open(QIODevice.ReadOnly);
        var dialog = loader.load(file);
        var layout = new QVBoxLayout();
        file.close();

        var btnReopen = dialog.children()[findWidget(dialog, "btnReopen")];
        if(btnReopen == null) {
            return;
        }

        var btnClose = dialog.children()[findWidget(dialog, "btnClose")];
        if(btnClose == null) {
            return;
        }

        var chkShowAgain = dialog.children()[findWidget(dialog, "chkShowAgain")];
        if(chkShowAgain == null) {
            return;
        }

        btnReopen["clicked()"].connect(this, this.setReopen);
        btnClose["clicked()"].connect(this, this.setClose);
        chkShowAgain["stateChanged(int)"].connect(this, this.saveShowAgain);

        dialog.modal = true;
        dialog.setVisible(true);
    },

    setReopen: function() {
        vdebug("Reopening processes!");
        this.startSubProcess();
    },

    setClose: function() {
        vdebug("Closing everything!");
        vidaliaApp.quit();
    },

    saveShowAgain: function(state) {
        this.tab.saveSetting("DontShowCloseDialog", String(state == 2));
    },

    updateBrowserEnv: function() {
        vdebug("tbb@updateBrowserEnv");
        /* Set TZ=UTC (to stop leaking timezone information) and
         * MOZ_NO_REMOTE=1 (to allow multiple instances of Firefox */
        var newenv = QProcessEnvironment.systemEnvironment();
        newenv.insert("TZ", "UTC");
        newenv.insert("MOZ_NO_REMOTE","1");

        var control = String(torControl.getInfo("net/listeners/control"));
        var socks = String(torControl.getInfo("net/listeners/socks"));

        var control_list = control.split(":");
        if(control_list.length < 2)
            return newenv.toStringList();

        this.host = control_list[0];
        this.control_port = control_list[1].replace(",", "");

        var socks_list = socks.split(":");
        if(socks_list.length < 2)
            return newenv.toStringList();

        this.socks_port = socks_list[1].replace(",","");

        newenv.insert("TOR_CONTROL_PORT", String(this.control_port));
        newenv.insert("TOR_SOCKS_PORT", String(this.socks_port));

        //vdebug(newenv.toStringList());

        return newenv.toStringList();
    },
};
