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
    vdebug(QProcess.NotRunning);
    this.tab = new VidaliaTab("Browser Bundle Settings", "TBB"); // We need this to access the settings later
    this.browserProcess = new HelperProcess();
    this.proxyProcess = new HelperProcess();

    this.browserProcess['startFailed(QString)'].connect(this, this.onBrowserFailed);
    this.proxyProcess['startFailed(QString)'].connect(this, this.onProxyFailed);
    this.browserProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onSubProcessFinished);
    this.proxyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onSubProcessFinished);

    torControl["authenticated()"].connect(this, this.startSubProcess);
    // Show a popup when tor's started so that users wait for the new
    // Firefox, so that they don't open a firefox themselves and think they
    // are using tor when they are not?
    //torControl["started()"].connect(this, this.showWaitDialog);
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

    var groupBox = this.widget.children()[findWidget(this.widget, "groupBox")];
    if(groupBox == null) {
      return this.tab;
    }

    this.btnSave = groupBox.children()[findWidget(groupBox, "btnSave")];
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

    return this.tab;
  },

  saveSettings: function() {
    this.tab.saveSetting(this.BrowserExecutable, this.lineExecutable.text);
    this.tab.saveSetting(this.BrowserDirectory, this.lineDirectory.text);
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
//        We don't want to quit, we can re-launch the browser now, yay!
//        vidaliaApp.quit();
      } else {
//        So this is useless too
//        QTimer *browserWatcher = new QTimer(this);
//        connect(browserWatcher, SIGNAL(timeout()), this, SLOT(onCheckForBrowser()));
//        browserWatcher->start(2000);
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

    if (this.tab.getSetting(this.BrowserDirectory, "") != "") {
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

    /* Set TZ=UTC (to stop leaking timezone information) and
    * MOZ_NO_REMOTE=1 (to allow multiple instances of Firefox */
    var newenv = this.browserProcess.systemEnvironment();
    newenv.push("TZ=UTC");
    newenv.push("MOZ_NO_REMOTE=1");

    this.browserProcess.setEnvironment(newenv);

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
  },

  startSubProcess: function() {
    vdebug("TBB@startSubProcess");

    vdebug("is it connected?");
    if(!torControl.isConnected())
      return;
    vdebug("yes");

    while(!torControl.isCircuitEstablished()) {
      vdebug("Waiting on circuit established");
    }
    vdebug("circuit established");

    var proxyExecutable = this.tab.getSetting(this.ProxyExecutable, "");
    var runAtStart = this.tab.getSetting(this.RunProxyAtStart, "");
    var proxyExecutableArguments = this.tab.getSetting(this.ProxyExecutableArguments, "");

    if(runAtStart) {
      vdebug("TBB@starting proxy");
      this.proxyProcess.start(proxyExecutable, proxyExecutableArguments);
    }

    var browserExecutable = this.tab.getSetting(this.BrowserExecutable, "");
    var browserDirectory = this.tab.getSetting(this.BrowserDirectory, "");

    if(browserDirectory != "") {
      this.launchBrowserFromDirectory();
    } else if(browserExecutable != "") {
      var newenv = this.browserProcess.systemEnvironment();
      newenv.push("TZ=UTC");

      this.browserProcess.setEnvironment(newenv);
      this.browserProcess.start(browserExecutable, "-no-remote");
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
    print("tbb@showExecDialog");
    this.lineExecutable.text = QFileDialog.getOpenFileName(this, "Choose a directory...", "/");
  },
};
