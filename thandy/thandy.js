importExtension("qt");
importExtension("qt.core");
importExtension("qt.gui");
importExtension("qt.uitools");

var thandy = {
    start: function() {
		    vdebug("Thandy@start");
        this.tab = new VidaliaTab("Thandy Configuration", "Thandy"); // We need this to access the settings later
        this.thandyProcess = new QProcess();
        this.ts = new QTextStream(this.thandyProcess);
        this.timer = new QTimer();

        this.timer.start(1*1000*60);
        this.timer['timeout()'].connect(this, this.doCheck);

        this.thandyProcess['readyReadStandardOutput()'].connect(this, this.checkStdin);
        this.thandyProcess['finished(int, QProcess::ExitStatus)'].connect(this, this.onFinished);

        this.checkToggle = false;
        this.checking = false;
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

        var portInfo = this.widget.children()[findWidget(this.widget, "portInfo")];
        if(portInfo == null) {
            return this.tab;
        }

        return this.tab;
    },

    stop: function() {
        vdebug("Thandy@stop");
    },

};
