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

        this.thandyProcess['readyReadStandardOutput()'].connect(this, this.checkStdin);
        this.thandyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onFinished);

        this.checkToggle = false;
        this.checking = false;
    },

    load: function() {
        this.chkPeriodicallyCheck.setCheckState((this.tab.getSetting("PeriodicallyCheck", "true") == "true")?Qt.Checked:Qt.Unchecked);
        this.spnMin.value = this.tab.getSetting("CheckInterval", 1);
        this.chkDownload.setCheckState((this.tab.getSetting("Download", "true") == "true")?Qt.Checked:Qt.Unchecked);
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

        this.checkToggle = !this.checkToggle;
        if(!this.checkToggle) {
            return;
        }

        this.checking = true;

        vdebug("Checking for updates...");
        this.thandyProcess.setReadChannel(QProcess.StandardOutput);
        this.thandyProcess.start("/home/chiiph/Code/thandy-notes/updater/bin/updater",
                                 ["--datadir", "/home/chiiph/Code/thandy-notes/updater/bin/", "--check"],
                                 QIODevice.ReadOnly);
    },

    onFinished: function(exitCode, exitStatus) {
        vdebug("Thandy@onFinished");
        this.checking = false;
    },

    checkStdin: function() {
        vdebug("Thandy@checkStdin");
        vdebug("Can read line!----------------------------------------------");
        var list = this.ts.readAll().split("\n");
        for(i = 0; i<list.length; i++)
            vdebug(list[i]);
        vdebug("------------------------------------------------------------");
    },

    buildGUI: function() {
        vdebug("Thandy@buildGUI");
        if(this.tab != null)
            return this.tab;

        // Load the GUI file
        this.tab = new VidaliaTab("Browser Bundle Settings", "TBB");

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
        this.chkDownload = grpInterval.children()[findWidget(grpUpdate, "chkDownload")];

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
