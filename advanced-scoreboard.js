/**
 * Advanced Scoreboard - A better scoreboard plugin for BBLog (https://getbblog.com)
 * 
 * @author Neutr0nst4r - Original: Cr1N
 * @version 1.2
 */

BBLog.handle("add.plugin", {
    /* Plugin Infos */
    id : "bf4-advanced-scoreboard-plugin",
    name : "Advanced Scoreboard",
    version : '1.2',
    build: '20191218',

    /* Plugin load. This is called only once when battlelog is loaded.  */
    init : function(instance)
    { 
        // Store the path at initizliation
        instance.data.currentPath = location.pathname;
        //instance.debug("Plugin Initialized on path " + location.pathname);

        if (location.pathname.match(new RegExp("^/bf4/(|[a-z]{2}/)(servers|serverbrowserwarsaw)/show/pc/.*","i")))         {
            //instance.debug("Server paged detected, initializing main handler");
            instance.handler(instance);
        }
    },
    /* Called each time the DOM changes.*/
    domchange: function(instance) {
        if (location.pathname == instance.data.currentPath) {
            /*
            $(document).ready(function () {
                if (instance.data.pluginLoaded && $("#live-header").is(":visible")) {
                    console.log("Plugin is loaded though, scoreboard not initialised...");
                    instance.unloadPlugin(instance); //URL has changed, unload the plugin.
                    instance.handler(instance);
                }
            })             
            */
        } else {

            if (instance.data.pluginLoaded) {
                instance.unloadPlugin(instance); // URL has changed, unload plugin.
            }

            instance.data.currentPath = location.pathname;

            if (location.pathname.match(new RegExp("^/bf4/(|[a-z]{2}/)(servers|serverbrowserwarsaw)/show/pc/.*", "i"))) {
                //instance.debug("Calling main handler");

                $(document).ready(function() {
                    instance.handler(instance);
                })
            }

        }
    },
    
    /**
     * Starts and stops the ticker for the scoreboard refresh
     * 
     */
    ticker : {
        isActive : false,
        id : false,
        start : function(instance) {
            if (this.isActive || this.id) {
                instance.debug(instance, 2, 'Attempted to start ticker when existing ticker is already active');
                return false;
            }
            this.id = setInterval(function () {
                instance.updateAll(instance);
            }, 5000);
            this.isActive = true;
            instance.debug(instance, 0, 'Ticker has been started  (' + this.id.toString() + ')');

            return true;
        },
        stop : function(instance) {
            if (!this.isActive || !this.id) {
                instance.debug(instance, 2, 'Attempted to stop a ticker but no active ticker was found');
                
                return false;
            }
            clearInterval(this.id);
            this.id = false;
            this.isActive  = false;
            instance.debug(instance, 0, 'Ticker has been stopped');
            return false;
        }
    },

    /**
     * Wrapper to interface with native BattleLog functions
     *
     */

    battlelog : {  
        //Holds lookup information
        lookup : {},
        /**
         * Return the image class for a given vehicle
         *
         * @param   guid    Weapon GUID
         * @param   type    Type of image, 0 -> lineart, 1 -> fancy
         */
        getVehicleImage : function(guid, type) {
            var vehicleItems = window.items.game_data.compact.vehicles;
            var vehicle = vehicleItems[guid];
            var vehicleArt = vehicle.see[type];
            var imageClass = vehicleItems[vehicleArt].imageConfig.slug;

            return imageClass
        },
        /**
         * Return the image class for a given vehicle
         *
         * @param   guid    Weapon GUID
         * @param   type    Type of image, 0 -> lineart, 1 -> fancy
         */
        getWeaponImage : function(guid, type) {
            var weaponItems = window.items.game_data.compact.weapons;
            var weapon = weaponItems[guid];
            var weaponArt = weapon.see[type];
            var imageClass = weaponItems[weaponArt].imageConfig.slug;

            return imageClass;
        },
        /**
         * Return the map title from the short name
         *
         * @param mapName   Short name for the map
         *
         */
        getMapTitle : function(mapName) {
            //Might want to refactor here
            if (typeof this.lookup.gameserverwarsaw == 'undefined') {
                this.lookup.gameserverwarsaw = gamedatawarsaw.function_warsawgameserver();
            }

            mapTitle = this.lookup.gameserverwarsaw.mapLookup[mapName].label;

            return mapTitle;
        },

        /**
         * Return the localized string for a game-mode
         *
         * @param gameMode  The game mode
         */
        getGameMode : function(gameMode) {
            return gamedata.function_localizedGameMode(2048, gameMode); //2048 = bf4
        },

        /**
         * Return a JSON Object containing information about the server
         * 
         * @param   serverHash      The unique hash identifying the server
         * @param   callback        The function to be executed on success
         */
        getServerInfo: function(serverHash, callback) {
            $.ajax({
                url: 'https://battlelog.battlefield.com/bf4/servers/show/' + serverHash + "/?json=1",
                type: 'GET',
                async: true,
                cache: false,
                timeout: 30000,
                success: function(data) {
                    callback(data);
                }
            });
        }


    },

    data : {
        advancedViewPlayer : 0, //Persona ID of player to show advanced statistics for
        animationActive : false,
        asLiveUpdate : false,
        asTrackerUpdate : false,
        charts : {"skillDistribution" : false, "tickets" : false,},
        currentChart: false,
        ticketsChart : false,
        currentPath : '',
        drawMode : "player",
        gameServerWarsaw : gamedatawarsaw.function_warsawgameserver(),
        latestScoreboardData : {}, //Holds the most recently retrieved set of scoreboard data to present unneccessary requests
        mode : 'scoreboard', //Mode of the plugin
        onServerPage : false,
        pluginLoaded : false,
        scoreboard : {
            advancedViewPlayer : false,
            animationActive : false,
        },
        server : {},
        tracker : {"tickets" : {}, "kills" : {},} //Track various aspects of the round over time
    },

    //Holds player statistics
    playerStats: {},
    // Holds player vehicle statistics
    playerVehicleStats : {},


    // (REFACTOR) Add at least some translations where required
    translations: {
	    "en":
		{
		    "settings-title" : "Settings",
		},
	    "de":
		{
		    "settings-title" : "Einstellungen",
		}
	},

    /* Main handler */
    handler: function(instance) {

        //instance.battlelog.getServerInfo()




        // Allow in-browser debugging of the plugin instance
        window.asDebug = instance;

        // Clear any previous tickers
        instance.ticker.isActive = false;
        instance.ticker.id = false;

        // If the plugin is not configured, run the default configuration options
        if (!instance.storage('isConfigured')) { 
            instance.firstTimeRun(instance);
        }

		$('head').append('<link rel="stylesheet" href="https://raw.githubusercontent.com/neutr0nst4r/bblog-plugins/main/advanced-scoreboard.css" type="text/css" />')
		$('head').append('<link rel="stylesheet" href="cdnjs.cloudflare.com/ajax/libs/c3/0.7.11/c3.min.css" type="text/css" />');

        // Load charting library
        // (REFACTOR) (Make these includes optional or remove all)
        $.ajax({
            url: 'https://cdnjs.cloudflare.com/ajax/libs/d3/5.14.2/d3.min.js',
            success: instance.debug(instance, 0, 'Loaded D3'),
            dataType: "script",
            cache: true
        });
        $.ajax({
            url: 'https://cdnjs.cloudflare.com/ajax/libs/c3/0.7.11/c3.min.js',
            success: function() {
                instance.debug(instance, 0, 'Loaded C3');
                instance.data.ticketsChart = c3.generate({
                    bindto: '#as-server-chart',
                    data: {
                        columns: [],
                        colors: {
                            'US': '#2f7191',
                            'RU': '#ff8e42',
                            'CN': '#ff8e42'
                        }
                    },
                    point: {
                        r: 0
                    },
                    axis: {
                        x: { show: false },
                        y: {
                            tick: {
                                values: function() {
                                    var values = [];
                                    for (var teamId in instance.data.tracker.tickets) {
                                        var team = instance.data.tracker.tickets[teamId];
                                        var teamName = team[0];
                                        var records = team.length - 1;

                                        if (records <= 50) {
                                            var max = team[1];
                                            var min = team[team.length - 1];
                                        } else {
                                            var max = values.push(team[team.length - 50]);
                                            var min = values.push(team[team.length - 1]);
                                        }

                                        values.push(max);
                                        if (Math.abs(max - min) > 100) {
                                            values.push(min);
                                        }

                                    }

                                    return values;
                                }
                            }
                        }
                    }
                });
            },
            dataType: "script",
            cache: true
        });

        //Load sizeof (debug only!)
        /* $.ajax({
            url: 'http://i242clan.com/plugin/sizeof.js',
            success: instance.debug(instance, 0, 'Loaded sizeof.js'),
            dataType: 'script',
            cache: true
        }); */

        // Load items library from battlelog if not present
        if (!window.items) {            
            var path = "/public/gamedatawarsaw/warsaw.items.js";        
            var loadedLib = $.ajax(
            {
                type: "GET",
                dataType: "script",
                url: base.asset(path),
                cache: true
            });
        } else {
            //instance.debug("Items Library already present!")
        }

        // Hide the default BattleLog scoreboard
        $("#server-players-list").hide();

        // Inject the container for the scoreboard
        $("#serverbrowser-page").after('<div id="as-container" class="box"><header><h1>Live Scoreboard - ' + instance.drawSelectors(instance) + '</h1></header><div id="as-container-inner" class="box-content"></div></div>');

        $("#as-container-inner").append('<div id="as-scoreboard-container"></div>');

        var debugWindow = '<div id="as-debug-window" style="display:'+ (instance.storage('debuggingEnabled') ? 'block' : 'none') + '"><h6 class="as-header">Debug Information</h6><div id="as-debug-output"></div></div>';
        $("#as-container-inner").append(debugWindow);

        //Overlay DIV
        $("#as-container-inner").append('<div class="as-overlay"></div>');

        instance.updateAll(instance);

        //Live update interval
        if (instance.storage('liveEnabled')) {
            instance.ticker.start(instance);
        }

        //Attach event handlers

        instance.attachEventHandlers(instance);
    },

    attachEventHandlers : function(instance) {
        /** EVENT HANDLERS **/

        //Change player view

        $("#as-show-squads").click(function () {
            instance.data.drawMode = "squad";
            instance.updateHTML(instance);
            instance.debug(instance, 0, 'Draw Mode set to SQUADS');
        });

        //Handler for selector hilighting

        $(".view-selector").click(function ()
        {
            $(".view-selector").removeClass("view-selector-active");
            $(this).addClass("view-selector-active");
        });

        // Handler for clicking on team join

        $("#as-container").on('click', '.as-join-team', function() {
            var teamId = $(this).attr('data-team-id');
            var teams = instance.data.latestScoreboardData.teams;

            for (var i = 0; i < teams.length; i++) {
                var team = teams[i];
                if (team.status.teamId == teamId) {
                    instance.joinTeam(team);
                    return;
                }
            }
        });

        //Handler for clicking on a player row
        
        $("#as-container").on('click', '.as-player', function() {
            var personaId = $(this).attr('personaid');
            instance.debug(instance, 0 , ('Player row has been clicked. PersonaId: ' + personaId));

            var thisRow = $(this);

            if (thisRow.hasClass('as-advanced-stats-selected')) {
                instance.data.advancedViewPlayer = false;
                instance.data.scoreboard.animationActive = true;
                $(".as-advanced-player-view").slideUp("fast", function() {
                    $(".as-scoreboard-advanced-stats-row").remove();
                    thisRow.removeClass("as-advanced-stats-selected");
                    instance.data.scoreboard.animationActive = false;
                });

                return;
            }

            //All open advanced stats view rows
            var existingRows = $(".as-scoreboard-advanced-stats-row");
            
            //If there are any stats view's open, close them
            if (existingRows.length > 0) {   
                var attRows = $(".as-advanced-stats-selected"); 
                $(".as-advanced-player-view").slideUp("fast", function() {
                    existingRows.remove();
                    attRows.removeClass("as-advanced-stats-selected");
                });
            }

            instance.data.advancedViewPlayer = personaId;
            var html = instance.createAdvancedPlayerView(instance, personaId, false);
            thisRow.addClass('as-advanced-stats-selected').after(html);
            instance.data.scoreboard.adimationActive = true;
            $(".as-advanced-player-view").slideDown("fast", function() {
                instance.data.scoreboard.animationActive = false;
            });




        });

        //Handler for clicking a role title and expanding the top players

        $("#as-container").on('click', '.as-role-title-row', function () {
            console.log("Clicked role title row");
            var roleRow = $(this).next("tr").find(".as-role-top-players");

            if( roleRow.is(":visible") )
            {
                roleRow.slideUp("fast");
            } else {
                roleRow.slideDown("fast");
            }
        });


        //Handler for clicking the player join button

        $("#as-container").on('click', '#as-ao-join', function() {

            var personaId = $(this).attr('persona-id');

            instance.joinPlayer(personaId);

        });


        $("#as-container").on('click', '#as-show-squads', function () {
            instance.data.drawMode = "squad";
            instance.updateHTML(instance);
        });

        $("#as-container").on('click', '#as-show-players', function () {
            instance.data.drawMode = "player";
            instance.updateHTML(instance);
        });

        $("#as-container").on('click', '#as-show-roles', function () {
            instance.data.drawMode = "role";
            instance.updateHTML(instance);
        });

        $("#as-container").on('click', '#as-show-charts', function () {
            instance.data.drawMode = "charts";
            instance.drawCharts(instance);
        });

        $("#as-container").on('click', '#as-settings', function () {
            instance.data.drawMode = "settings";
            instance.drawSettings(instance);
        });

        $("#as-container").on('click', '#as-quit-game', function () {
            var game = gamemanager.gameState.game;
            console.log("Quitting game " + game);
            gamemanager._killGame(gamemanager.gameState.game);
        });

        //Handler for hiding the stats window

        $("#server-page").on('click', '.as-stats-close', function () {

            $("#as-stats-container").animate({
                opacity: 0,
                height: 'toggle'
            },
            1000, function ()
            {
                $("#as-stats-container").remove();
                instance.data.mode = 'scoreboard';
                instance.data.scoreboard.animationActive = true;

                $("#as-container").animate({
                    opacity: 1,
                    height: 'toggle'
                }, 1000, function ()
                {
                    instance.data.scoreboard.animationActive = false;
                    instance.updateHTML(instance);
                });

                $('html, body').animate({ scrollTop: $("#as-scoreboard-container").offset().top }, 1000);
            });
        });

        //Settings

        //Event handler for the display stat select menu
        $("#as-select-display-stat").on('change', function(){

            instance.storage('displayStat', this.value);
            instance.updateHTML(instance);

        });

        $("#content").on('click', '#as-settings-close', function(){
            $("#as-settings-container").remove();
        });

        //Sorting event handlers

        $("#as-container").on('click', '.as-scoreboard-head td', function() {   
            var elem = $(this);


            if( elem.hasClass("sort-desc") )
            {
                console.log("has sort-desc")
                elem.removeClass("sort-desc").addClass("sort-asc");
                instance.storage('sortMode', 'asc' );
            }
            else if( elem.hasClass("sort-asc") )
            {
                console.log("has sort-asc")
                elem.removeClass("sort-asc").addClass("sort-desc");
                instance.storage('sortMode', 'desc' );
            }
            else 
            {
                console.log("unclassed")
                elem.addClass("sort-desc");
                instance.storage('sortMode', 'desc');
            }
            instance.storage('sortAttribute', this.getAttribute("sort"));
            instance.updateHTML(instance);
        });


        //Event handler for hilighting checkbox

        $("#as-container").on('change', '#as-enable-hilighting', function(){

            if(this.checked) {
                instance.storage('hilightingEnabled', true);
            } else {
                instance.storage('hilightingEnabled', false);
            }
            instance.updateHTML(instance);  

        });

        //Event handler for friend hilighting

        $("#as-enable-friend-hilighting").change(function() {

            if (this.checked) {
                instance.storage('hilightingEnabled', true);
            } else {
                instance.storage('hilightingEnabled', false);
            }

            instance.updateHTML(instance);  

        });

        // Event handler for detailed vehicle overview

        $("#content").on('change', '#as-detailed-vehicles', function() {
            instance.modifySetting(instance, 'detailedVehicles', this.checked);
        });

        // Vehicle kill threshold change

        $("#content").on('change', '#as-vehicle-threshold', function() {
            var threshold = $(this).val();
            if (threshold) {
                instance.storage('vehicleThreshold', threshold);
            }
        });

        //Scroll right in the advanced view

        //Event handler for the live update checkbox
        $("#content").on('change', '#as-enable-live', function() {
            if (this.checked) {

                $("#as-live-indicator").css({ "background-color": "#78c753" });

                instance.storage('liveEnabled', true);

                if (!instance.ticker.isActive) {

                    //Start the ticker
                    instance.ticker.start(instance);

                    //Immediately refresh the scoreboard
                    instance.updateAll(instance);

                    instance.debug(instance, 0, 'Live Scoreboard Enabled');
                } 
            } else {
                $("#as-live-indicator").css({"background-color": "red"});
                instance.storage('liveEnabled', false);

                if(instance.ticker.isActive) {
                    instance.ticker.stop(instance);

                    instance.debug(instance, 0, 'Live Scoreboard Disabled');
                }
            }

        });

        //Event handler - Enable debugging

        $("#content").on('change', '#as-enable-debugging', function() {
            if (this.checked) {
                instance.storage('debuggingEnabled', true);
                $("#as-debug-window").fadeIn();
            } else {
                instance.storage('debuggingEnabled', false);
                $("#as-debug-window").fadeOut();
            }
        });

        //Stats

        $("#server-page").on('click', '.as-stats-select-weapons', function () {
            $(".as-stats-vehicles").slideUp('fast', function () {
                $(".as-stats-weapons").slideDown('fast');
            });
        });

        $("#server-page").on('click', '.as-stats-select-vehicles', function () {
            $(".as-stats-weapons").slideUp('fast', function () {
                $(".as-stats-vehicles").slideDown('fast');
            });
        });

        //Join on a specific team

        $("#as-container").on('click', '.join-team', function () {
            var teamId = $(this).attr('team-id');
            //alert("I want to join " + teamId);

            var teams = instance.data.latestScoreboardData.teams;
            var team = {};
            for (var i = 0; i < teams.length; i++) {
                if(teams[i].status.teamId == teamId) {
                    team = teams[i];
                    break;
                }
            }

            //Iterate team and find lowest ranked played
            var lowestRank = 140;
            var lowestPlayer = {};

            for (var i = 0; i < team.players.length; i++) {
                var player = team.players[i];
                if (player.rank < lowestRank) {
                    lowestRank = player.rank;
                    lowestPlayer = player;
                }
            }

            instance.joinPlayer(lowestPlayer.personaId);
        });



        $("#as-render-scorboard-button").click(function(){

            instance.updateAll(instance);
            
        });

        // Choosing the custom stat

        $("#as-select-stat").change(function() {
            var value = $(this).val();
            instance.storage('displayStat', value);
            instance.updateHTML(instance);
        });

    },
    /**
     * Is fired when the plugin is run for the first time. Configures default options and presents a welcome window.
     * 
     * @param   instance    Plugin instance
     *
     */
    firstTimeRun : function(instance) {
        instance.storage('hilightingEnabled', true);
        instance.storage('liveEnabled', true);
        instance.storage('displayStat', 'kdRatio');
        instance.storage('isConfigured', true); 
        instance.storage('hilightFriends', true);
        instance.storage('liveTracking', false);
        instance.storage('sortAttribute', "score");
        instance.storage('sortMode', "desc");
        instance.storage('useResetKdr', false);
        instance.storage('debuggingEnabled', false);
        instance.storage('detailedVehicles', false);
        instance.storage('vehicleThreshold', 500);
        alert("Configuration Parameters Successfully Set");
    },

    /**
	 * Allows the user to join the server on any player regardless of if they are on your friends list
	 *
	 * @param    personaId    The Battlelog Persona ID of the player to join
	 */	 
    joinPlayer : function(personaId) {
        var elem = document.getElementById("server-page-join-buttons");		
        var guid = elem.getAttribute("data-guid");
        var platform = elem.getAttribute("data-platform");
        var game = elem.getAttribute("data-game");
        window.gamemanager.joinServerByGuid(guid, platform, game, personaId, 1);
    },

    /**
     * Changes a setting variable (BBLog storage)
     * 
     * @param   instance        Plugin instance
     * @param   settingName     The name of the setting to store or modify
     * @param   settingValue    The desired value of the setting
     */
    modifySetting : function(instance, settingName, settingValue) {
        instance.storage(settingName, settingValue);
    },

    /**
     * Join on a specific team. Squad is chosen at random through selecting the lowest ranked player on the team who is not in a full squad.
     */
    joinTeam : function(team) {
        // Create squads

        var squads = {};

        for (var i = 0; i < team.players.length; i++) {
            var player = team.players[i];

            if (!player.hasOwnProperty('squad')) { // Player is not in a squad
                continue;
            }
            if (!squads.hasOwnProperty(player.squad)) {
                squads[player.squad] = [];
            }
            squads[player.squad].push(player);

        }
        
        var elegiblePlayers = [];

        for (var squadId in squads) {
            var squad = squads[squadId];
            var playerCount = squad.length;
            if (playerCount < 5) {
                for (var i = 0; i < playerCount; i++) {
                    elegiblePlayers.push(squad[i]);
                }
            }
        }

        // Sort by rank ascending
        elegiblePlayers.sort(function(a, b) {
            if (a.rank < b.rank)
                return -1;
            if (a.rank > b.rank)
                return 1;
            return 0;
        });

        var joinOn = elegiblePlayers[0].personaId;

        var elem = document.getElementById("server-page-join-buttons");
        var guid = elem.getAttribute("data-guid");
        var platform = elem.getAttribute("data-platform");
        var game = elem.getAttribute("data-game");
        window.gamemanager.joinServerByGuid(guid, platform, game, joinOn, 1);

    },

    /* Queue Experimentation */

    /*
     * Scoreboard Object - Handles all scoreboard related functions, e.g. updating/refreshing
     *
     *
     */
    scoreboard: {

        /**
         * Returns the HTML for the team header (summary) 
         * 
         * @param   instance            Plugin instance
         * @param   scoreboardData      Scoreboard Data     
         * @param   team                Team Object      
         */
        getTeamHeader: function(instance, scoreboardData, team) {
            // Get team attributes from their values
            var teamName = instance.lookup.teamName(scoreboardData.gameMode, team.status);
            var teamFlag = instance.lookup.teamFlag(teamName);

            var teamFlagImg = '';
            if (teamFlag) {
                teamFlagImg = '<img alt="flag" class="as-team-flag" src="' + teamFlag + '"></img>';
            }

            // Create the progress bar illustrating tickets remaining
            var progressBarWidth = Math.floor((team.status.tickets / team.status.ticketsMax) * 100);
            var teamType = instance.lookup.teamType(team.status.teamId); // CSS property for whether the team is home or away
            var progressBar = '<div title="' + team.status.tickets + '/' + team.status.ticketsMax + '" class="progress-bar thicker no-border ' + teamType + '" style="position: relative; display: inline-block; width: 100px; margin: 5px;"><div class="home progress-bar-inner" style="width:' + progressBarWidth + '%"></div></div>';

            // Average statistics for the team
            var teamAvg = {
                'skill': (team.globalStats.totalSkill / team.playersLoaded),
                'kdRatio': (team.globalStats.totalKd / team.playersLoaded),
                'resetKdRatio': (team.globalStats.totalResetKd / team.playersLoaded),
                'scorePerMinute': (team.globalStats.totalScorePerMinute / team.playersLoaded),
                'killsPerMinute': (team.globalStats.totalKillsPerMinute / team.playersLoaded)
            }

            // Calculate "Strength" of the team
            // (REFACTOR) (Better strength formula and calculation)

            var teamStrength = (((teamAvg.killsPerMinute * teamAvg.resetKdRatio) * 10) + ((teamAvg.skill * teamAvg.scorePerMinute) / 10000)) * 10

            var teamInfo = `
				<table class="as-team-summary">
					<tr><th>Team</th><th>Players</th><th>Tickets</th><th>K/D(G)</th><th>Skill</th><th>Strength</th><th>Join</th></tr>
					<tr>
					<td>${teamFlagImg} ${teamName}</td>
					<td>${team.players.length}/${(scoreboardData.maxPlayers / 2).toFixed(0)}</td>
					<td>${progressBar}</td>
					<td>${teamAvg.kdRatio.toFixed(2)}</td>
					<td>${teamAvg.skill.toFixed(0)}</td>
					<td>${teamStrength.toFixed(0)}</td>
					<td><button data-team-id="${team.status.teamId}" class="as-join-team btn btn-primary">Join</button></td>
					</tr>
                </table>
			`;

            return teamInfo;
        },
        
        /**
         * Returns the HTML for a player row in the scoreboard
         * 
         * @param   instance            Plugin instnace
         * @param   player              Player Object
         */
        getPlayerRow : function(instance, player) {
            // Player's rank icon
            var pRank = `<div class="bf4-rank rank small r${player.rank} rank_icon" data-rank="${player.rank}"></div>`;

            // Player's tags and name
            var pName = player.tag.length > 0 ? `[${player.tag}] ${player.name}` : player.name;
			pName = `<a target="_blank" href="/bf4/user/${player.name}/">${pName}</a>`;

            // Player's in-game K/D
            var pKD = player.deaths == 0 ? player.kills : player.kills / player.deaths;

            var hilightingType = false;

            if (instance.storage('hilightingEnabled') && player.statsLoaded) {
                hilightingType = instance.lookup.hilightingClass(instance.storage('displayStat'), player.pDisplayStat);
            }

            //var friends = comcenter.getFriendsListFromLs(); //REFACTOR

            // The custom stat to display for the player
            var displayStat = player.statsLoaded ? player.pDisplayStat.toFixed(2) : '<div class="loader small"></div>';

            // Whether or not this player's stats are expanded
            var statsExpanded = player.id == instance.data.advancedViewPlayer ? true : false;

            //Create the HTML for this player's scoreboard row
            var html = '<tr class="as-player' + (statsExpanded ? ' as-advanced-stats-selected' : '') + (hilightingType ? ' ' + hilightingType : '') + '" personaid="' + player.id + '"><td>' + pRank + '</td><td>' + pName + '</td><td>' + player.kills + '</td><td>' + player.deaths + '</td><td>' + player.score + '</td><td>' + pKD.toFixed(2) + '</td><td>' + displayStat + '</td></tr>'

            return html;

        },
        /**
         * Draw the scoreboard in the default player format
         *
         * @param    instance        Plugin instance
         * @param    scoreboardData  Scoreboard data
         */
        drawPlayers : function(instance, scoreboardData) {
            instance.debug(instance, 0, 'Drawing PLAYER scoreboard');

            var s = scoreboardData;        
            var teams = instance.calculateTeamTotals(instance, scoreboardData);
            
            /* Load in the BBLog radar and check if any of the players on the server match */
            // (REFACTOR) (Better radar logic and implementation)

            var html = "";

            // For each team
            for (i = 0; i < teams.length; i++) {
                var team = teams[i];

                // Create wrapper and table for team
                html += '<div class="as-scoreboard-wrapper" teamId = "' + team.status.teamId + '">' +
                    '<table class="table as-scoreboard-table" teamId="' + team.status.teamId + '">' +
                    '<thead><tr class="as-scoreboard-details">' +
                    '<td colspan="7">';
                
                // Get team header
                html += this.getTeamHeader(instance, scoreboardData, team);
            
                //HTML for table header
                html += '<tr class="as-scoreboard-head">';

                var columns = [
                    {header : "Rank", sortAttribute : "rank"},
                    {header : "Name", sortAttribute : "name"},
                    {header : "K", sortAttribute : "kills"},
                    {header : "D", sortAttribute : "deaths"},
                    {header : "Score", sortAttribute : "score"},
                    {header : "K/D", sortAttribute : "kd"},
                    {header : instance.lookup.displayStat(instance.storage('displayStat')), sortAttribute : "pDisplayStat"}
                ]

                var sortAttribute = instance.storage('sortAttribute');
                var sortMode = instance.storage('sortMode');

                //Iterate the defined columns and append to the HTML
                for (var j = 0; j < columns.length; j++) {   
                    var column = columns[j];
                    html += '<td ' + (column.sortAttribute == sortAttribute ? 'class="sort-' + sortMode + '"' : '') +' sort="' + column.sortAttribute + '">' + column.header + (column.sortAttribute == sortAttribute ? '<div class="sort-' + sortMode + '"></div>' : '') + '</td>';
                }

                html += '</tr></thead>';


                //Sort by the defined attribute, descending or ascending
                team.players.sort(function (a, b) {
                    if (sortMode == 'desc') {
                        return a[sortAttribute] == b[sortAttribute] ? 0 : +(a[sortAttribute] < b[sortAttribute]) || -1;
                    } else {
                        return a[sortAttribute] == b[sortAttribute] ? 0 : +(a[sortAttribute] > b[sortAttribute]) || -1;
                    }
                });

                //Iterate over the players on the team and create a table row for them
                for (var j = 0; j < team.players.length; j++) {
                    var player = team.players[j];
                    html += this.getPlayerRow(instance, player);
                    
                    //If a specific player is selected for the advanced view, inject the HTML here (Necessary so advanced information remains displayed on scoreboard refresh)
                    if (player.id == instance.data.advancedViewPlayer ) {
                        html += instance.createAdvancedPlayerView(instance, player.id, true);
                    }
                    
                }

                //Create the table footer for the team

                //Average rank of the player's on the team
                var avgRank = Math.floor(team.totalRank/team.players.length);
                var avgRankIcon = '<div class="bf4-rank rank small r' + avgRank + ' rank_icon" data-rank="' + avgRank +'"></div>';

                //Average in-game KDR of the player's on the team
                var avgKD = team.totalDeaths == 0 ? team.totalKills : team.totalKills/team.totalDeaths;

                //Average of the custom-displayed statistic of the player's on the team
                var avgpDisplayStat = team.totalPDisplayStat == 0 ? '...' : (team.totalPDisplayStat/team.playersLoaded).toFixed(2);

                //Create the HTML for the table footer
                html += '<tfoot><tr class="as-scoreboard-foot"><td>'+ avgRankIcon +'</td><td></td><td>'+ team.totalKills +'</td><td>' + team.totalDeaths + '</td><td>' + team.totalScore +'</td><td>' + avgKD.toFixed(2) + '</td><td>' + avgpDisplayStat + '</td></tr></tfoot>';

                html += '</table>';

                //Display the team's commander if one exists
                if (team.commander) { //Refactor
                    var commander = team.commander;

                    var cRank = '<div class="bf4-rank rank small r' + commander.rank + ' rank_icon" data-rank="' + commander.rank + '"></div>'

                    var cKd = commander.deaths == 0 ? commander.kills : commander.kills / commander.deaths;
                    //Player name including tags
                    var cName = commander.tag.length > 0 ? '[' + commander.tag + ']' + commander.name : commander.name;
                    pName = '<a target="_blank" href="/bf4/user/' + commander.name + '/">' + cName + '</a>';
                    html += '<table class="table as-commander-scoreboard"><tbody><tr><td>' + cRank + '</td><td>' + cName + '</td><td>' + commander.kills + '</td><td>' + commander.deaths + '</td><td>' + commander.score + '</td><td>' + cKd + '</td><td>' + commander.pDisplayStat + '</td></tr></tbody></table>';
                }

                html += '</div>';
            }

            this.drawRoundHeader(instance, s);

            if ($("#as-scoreboard-container").is(':visible')) { //REFACTOR
                $("#as-scoreboard-container").html(html)
            } else { //Catch issue with navigation
                instance.unloadPlugin(instance);
                instance.handler(instance);
            }
        },
        /**
         * Draw the scoreboard organised by squads
         *
         * @param   instance        Plugin instance
         * @param   scoreboardData  Scoreboard data retrieved from the remote gameserver
         */
        drawSquads : function(instance, scoreboardData) {
            instance.debug(instance, 0, 'Drawing SQUAD scoreboard');

            var s = scoreboardData;
            var teams = instance.calculateTeamTotals(instance, scoreboardData); //Refactor 

            html = "";

            for (var i = 0; i < teams.length; i++) {
                var team = teams[i];

                //Create wrapper and table for team
                html += '<div class="as-scoreboard-wrapper" teamId = "' + team.status.teamId + '">' +
                    '<table class="table as-scoreboard-table" teamId="' + team.status.teamId + '">' +
                    '<thead><tr class="as-scoreboard-details">' +
                    '<td colspan="7">';
                    
                html += this.getTeamHeader(instance, scoreboardData, team);

                //Sort the players based on their squad and calculate squad totals/averages
                var squadIds = []; //For sorting
                var squads = {};
                for (j = 0; j < team.players.length; j++) {
                    var player = team.players[j];

                    if (!squads.hasOwnProperty(player.squad)) { //First player in this squad, create squad object
                        squads[player.squad] = {
                            totalRank : player.rank,
                            totalKills : player.kills,
                            totalDeaths : player.deaths,
                            totalScore : player.score,
                            totalCustomStat : 0,
                            players : [player],
                            playersLoaded : 0,
                        };
                        //Add to the array of Ids
                        squadIds.push(player.squad);
                    } else { //Add player to existing squad and add stats to total
                        var existingSquad = squads[player.squad]; 
                        existingSquad.totalRank += player.rank;
                        existingSquad.totalKills += player.kills;
                        existingSquad.totalDeaths += player.deaths;
                        existingSquad.totalScore += player.score;
                        //Add player to list of squad's players
                        existingSquad.players.push(player);
                    }

                    //Add the custom stat if the player's global statistics have been loaded
                    if (instance.playerStats.hasOwnProperty(player.id)) {
                        var playerStats = instance.playerStats[player.id];
                        var customStat = playerStats.overviewStats[instance.storage('displayStat')];
                        squads[player.squad].totalCustomStat += customStat;
                        squads[player.squad].playersLoaded++;
                    }
                }

                //Sort the array of squadnames alphabeticaly
                squadIds.sort();


                for (var j = 0; j < squadIds.length; j++) {
                    var squadId = squadIds[j];
                    var squad = squads[squadId];
                    var squadName = instance.lookup.squadName(squadId);

                    if (squadId == 0) {
                        continue; // Id 0 = not in squad 
                    }

                    //Squad header                  
                    html += '<tr class="as-squad-row"><td colspan="7">' + squadName.toUpperCase() + ' [' + squad.players.length + '/5]</td/></tr>';

                    for (var k = 0; k < squad.players.length; k++) {
                        var player = squad.players[k];
                        // Generate table row
                        html += this.getPlayerRow(instance, player);
                        //If a specific player is selected for the advanced view, inject the HTML here (Necessary so advanced information remains displayed on scoreboard refresh)

                        if (player.id == instance.data.advancedViewPlayer) {
                            html += instance.createAdvancedPlayerView(instance, player.id, true);
                        } 
                    }

                    if (squad.players.length < 5) {

                        for (var k = 0; k < (5 - squad.players.length) ; k++) {
                            html += '<tr class="as-blank"><td colspan="7"></td></tr>';
                        }

                    }

                    //Calculate squad averages
                    var avgSquadRank = Math.floor(squad.totalRank / squad.players.length);
                    var avgSquadRankIcon = '<div class="bf4-rank rank small r' + avgSquadRank + ' rank_icon" data-rank="' + avgSquadRank + '"></div>';
                    var avgSquadKd = squad.totalDeaths > 0 ? squad.totalKills/squad.totalDeaths : squad.totalKills;
                    var avgSquadCustomStat = squad.playersLoaded > 0 ? squad.totalCustomStat/squad.playersLoaded : 0;

                    html += '<tr class="as-squad-summary"><td>' + avgSquadRankIcon + '<td></td><td>' + squad.totalKills + '</td><td>' + squad.totalDeaths + '</td><td>' + squad.totalScore + '</td><td>' + avgSquadKd.toFixed(2) + '</td><td>' + avgSquadCustomStat.toFixed(2) + '</td></tr>';
                    
                    if (j < squadIds.length - 1) {
                        html += '<tr class="as-squad-spacer"><td colspan="7"></td></tr>';
                    }
                }
                /*** Create tfoot from averages ***/

                //Calculate team averages
                var avgRank = Math.floor(team.totalRank/team.totalPlayers)
                var avgRankIcon = '<div class="bf4-rank rank small r' + Math.floor(team.totalRank/team.totalPlayers) + ' rank_icon" data-rank="' + Math.floor(team.totalRank/team.totalPlayers) +'"></div>'

                var avgKD = team.totalDeaths == 0 ? team.totalKills : team.totalKills/team.totalDeaths;
                var avgpDisplayStat = team.totalPDisplayStat == 0 ? '...' : (team.totalPDisplayStat/team.playersLoaded).toFixed(2);

                //HTML for scoreboard foot
                //html += '<tfoot><tr class="as-scoreboard-foot"><td>'+ avgRank +'</td><td></td><td>'+ team.totalKills +'</td><td>' + team.totalDeaths + '</td><td>' + team.totalScore +'</td><td>' + avgKD.toFixed(2) + '</td><td>' + avgpDisplayStat + '</td></tr></tfoot>';
                html += '</table>'
                html += '</div>';
            }

            this.drawRoundHeader(instance, s);

            if($("#as-scoreboard-container").is(':visible')) {
                $("#as-scoreboard-container").html(html);
            } else { //Catch issue with navigation
                instance.unloadPlugin(instance);
                instance.handler(instance);
            }
        },

        /*
         * This way is much better!
         * 
         */
        drawVehiclesss: function(instance,scoreboardData) {
            instance.debug(instance, 0, 'Drawing VEHICLE scoreboard');
            var s = scoreboardData;
            var teams = instance.calculateTeamTotals(instance, s);

            /*
             * Builds and returns the HTML for the vehicle role display
             * 
             */
            function buildVehicleHtml(teams, vehicleData) {
                // First build an array of categories and the total number of kills
                var vehicleTypes = {} 

                for (var i = 0; i < vehicleData.length; i++) {
                    var vehicles = vehicleData[i];
                    for (var vehicleType in vehicles) {
                        var vehicle = vehicles[vehicleType];
                        if (vehicleTypes.hasOwnProperty(vehicleType)) {
                            if (vehicle.totalKills > vehicleTypes[vehicleType].totalKills) {
                                vehicleTypes[vehicleType].totalKills = vehicle.totalKills;
                            }
                        } else {
                            vehicleTypes[vehicleType] = {
                                totalKills: vehicle.totalKills
                            }
                        }
                    }
                }
                console.log(vehicleTypes);
            }


            if (instance.storage('detailedVehicles')) {
                $("#as-scoreboard-container").html('<div class="as-loading-data"><div class="loader small"></div><p>Loading Vehicle Statistics...</p></div>');
                instance.calculateDetailedRoles(instance, s, function(vehicleData) {
                    buildVehicleHtml(teams, vehicleData);
                });
                return;
            } else {
                var vehicleData = instance.calculateRoles(instance, s);
                return;
            }
        },
        /**
         * Draw the scoreboard organised by the number of kills in each vehicle type
         * @param   instance        Plugin instance
         * @param   scoreboardData  Scoreboard datat retrieved from the remote gameserver
         */
        drawVehicles: function(instance, scoreboardData) {

            var _this = this;
            /*
            * Builds the HTML for the vehicle given a dataset of vehicle info
            */
            function getVehicleTable(teams, vehicleData) {
                var html = '';

                for (var i = 0; i < teams.length; i++) {
                    var team = teams[i];
                    var teamVehicles = vehicleData[i];

                    html += '<div class="as-scoreboard-wrapper" teamId = "' + team.status.teamId + '">' +
                                '<table class="table as-scoreboard-table" teamId="' + team.status.teamId + '">' +
                                    '<thead><tr class="as-scoreboard-details">' +
                                        '<td colspan="7">';

                    html += _this.getTeamHeader(instance, scoreboardData, team);

                    html += '</td></tr></thead><tbody>';

                    for (var categoryName in teamVehicles) {
                        var vehicle = teamVehicles[categoryName];

                        var vehicleImageClass = instance.battlelog.getVehicleImage(vehicle.guid, 0);
                        var vehicleImage = '<div class="as-table-role vehicle xsmall ' + vehicleImageClass + ' image"></div>';
                        
                        var playersAdded = 0; // Keep track of the players added
                        var vehiclePlayers = ''; // Store HTML for vehicle players

                        var ordered = instance.sortObject(vehicle.players, 'kills', 'desc');

                        console.log("Ordered:");
                        console.log(ordered);

                        for (var j = 0; j < ordered.length; j++) {
                            var personaId = ordered[j];
                            var playerVehicleStats = vehicle.players[personaId];
                            if (playerVehicleStats.kills < instance.storage('vehicleThreshold')) {
                                continue;
                            }
                            playersAdded++;
                            var player = playerVehicleStats.roundStats;
                            var pRank = '<div class="bf4-rank rank small r' + player.rank + ' rank_icon" data-rank="' + player.rank + '"></div>';
                            var pName = player.tag.length > 0 ? '[' + player.tag + ']' + player.name : player.name;
                            var pKD = player.deaths == 0 ? player.kills : player.kills / player.deaths;
                            var isFriend = false; //refactor

                            var hilightingType = '';
                            if (instance.storage('hilightingEnabled')) {
                                hilightingType = instance.lookup.hilightingClass(instance.storage('displayStat'), player.pDisplayStat);
                            };

                            //Generate table row
                            vehiclePlayers += '<tr class="as-player' + (player.personaId == instance.data.advancedViewPlayer ? ' as-advanced-stats-selected' : '') + (isFriend ? ' friend' : '') + (hilightingType ? ' ' + hilightingType : '') + '" personaid="' + player.personaId + '"><td>' + pRank + '</td><td>' + pName + '</td><td>' + player.kills + '</td><td>' + player.deaths + '</td><td>' + player.score + '</td><td>' + pKD.toFixed(2) + '</td><td>' + playerVehicleStats.kills + '</td></tr>';
                        }

                        if (playersAdded) {
                            html += '<tr><th class="as-team-vehicle-header" colspan="7">' + categoryName + vehicleImage + '</th></tr>';
                            html += vehiclePlayers;
                        }

                    }
                    html += '</tbody></table></div>';
                }



                instance.scoreboard.drawRoundHeader(instance, s);

                if ($("#as-scoreboard-container").is(':visible')) {
                    $("#as-scoreboard-container").html(html)
                } else { //Catch issue with navigation
                    instance.unloadPlugin(instance);
                    instance.handler(instance);
                }


            }

            instance.debug(instance, 0, 'Drawing VEHICLE scoreboard');
            var s = scoreboardData
            var teams = instance.calculateTeamTotals(instance, scoreboardData);

            if (instance.storage('detailedVehicles')) {

                if (!$(".as-scoreboard-wrapper").is(':visible')) {
                    $("#as-scoreboard-container").html('<div class="as-loading-data"><div class="loader small"></div><p>Loading Vehicle Statistics...</p></div>');
                }

                instance.calculateDetailedRoles(instance, s, function(vehicleData) {
                    getVehicleTable(teams, vehicleData);
                    
                });
            } else {
                var vehicleData = instance.calculateRoles(instance, s);
                getVehicleTable(teams, vehicleData);
            }
   

        },
        /*
         * Update the Advanced Scoreboard header to reflect time/map changes, etc
         *
         * @param   instance        Plugin instance
         * @param   scoreboardData  Scoreboard data retrieved from the remote gameserver
         */
        updateRoundHeader : function(instance, scoreboardData) {
            var s = scoreboardData;
            //The current map running on the server
            var currentMap = '<img class="current-map" src="//eaassets-a.akamaihd.net/bl-cdn/cdnprefix/9c0b010cd947f38bf5e87df5e82af64e0ffdc12fh/public/base/bf4/map_images/195x79/' + s.mapName.toLowerCase() + '.jpg"></img>' +
                '<div id="as-map-name">' + instance.data.gameServerWarsaw.mapLookup[s.mapName].label + '</div>' +
                '<div id="as-map-mode">' + instance.lookup.gameMode(s.gameMode) + '</div>';
            $("#as-scoreboard-mapinfo").html(currentMap);

            //Calculate the round time remaining
            var totalRoundTime = 3600 * (s.defaultRoundTimeMultiplier/100);
            var expiredTime = s.roundTime;      
            var secondsRemaining = totalRoundTime - expiredTime;
            var timeLeft = Math.floor(secondsRemaining/60) + 'M ' + (Math.round((secondsRemaining%60) * 100)/100) + 'S';

            //Calculate the total players
            var totalPlayers = 0;
            for (var i = 0; i < s.teams.length; i++) {
                var team = s.teams[i];
                totalPlayers += team.players.length;
            }


            //Round properties and info
            var roundInfo = '<table class="as-round-properties">' +
                '<tr><td>Players</td><td>' + totalPlayers + '/' + s.maxPlayers + (s.queueingPlayers > 0 ? '[' + s.queueingPlayers + ']' : '') + '</td></tr>' +
                '<tr><td>Time Remaining</td><td>' + timeLeft + 'S</td></tr>' + 
                '</table>';
            $("#as-scoreboard-round-properties").html(roundInfo);
        },

        /*
         * Draw the scoreboard header
         *
         * @param   instance        Plugin instance
         * @param   scoreboardData  Scoreboard data retrieved from the remote gameserver
         */

        drawRoundHeader: function(instance, scoreboardData) {
            var s = scoreboardData;
            var html = '';

            //Calculate the total players on the server by counting both teams

            var totalPlayers = 0;
            for (var i = 0; i < s.teams.length; i++) {
                var team = s.teams[i];
                totalPlayers += team.players.length;
            }

            //Map information
            html += '<div id="as-round-map">' +
                '<img class="current-map" src="//eaassets-a.akamaihd.net/bl-cdn/cdnprefix/9c0b010cd947f38bf5e87df5e82af64e0ffdc12fh/public/base/bf4/map_images/195x79/' +  s.mapName.toLowerCase() + '.jpg"</img>' +
                '<div id="as-round-map-title">' + instance.battlelog.getMapTitle(s.mapName) + '</div>' +    
                '<div id="as-round-mode">' + instance.battlelog.getGameMode(s.gameMode) + '</div>' +
            '</div>';

            //

            var queueingPlayers = s.queueingPlayers ? '[' + s.queueingPlayers + ']' : '';

            html += '<div id="as-round-properties">' +
                    '<div><i class="players-icon"></i><span>Players</span><span>' + totalPlayers + '/' + s.maxPlayers + queueingPlayers + '</span></div>' +
                '</div>';




            $("#as-server-info").html(html);

        }
    },

    drawCharts : function(instance)
    {
        //instance.debug("Okay, drawing charts...");

        //Create a div to hold the test chart
        if($("#as-scoreboard-container").is(':visible')) {
            $("#as-scoreboard-container").html('<div id="as-charting-container"></div>')
        } else { //Catch issue with navigation
            instance.unloadPlugin(instance);
            instance.handler(instance);
        }

        //Put tracking data into array
        var chartData = [];
        for( var dataSet in instance.data.tracker.tickets )
        {
            var data = instance.data.tracker.tickets[dataSet];
            //instance.debug(data);
            chartData.push(data);
        }
        /*
        instance.data.currentChart = c3.generate({
            bindto: '#as-charting-container',
            data: {
              columns: chartData
            },
            type: 'spline'
        });
        */
        //instance.debug("Here's the player stats");
        //instance.debug(instance.playerStats);

        //instance.debug("Here's the scoreboardData");
        //instance.debug(instance.data.latestScoreboardData);

        //Okay get the latest scoreboarddata

        var teamPlot = [];
        var teamNames = {};

        for(var team in instance.data.latestScoreboardData.teams)
        {
            var teamObject = instance.data.latestScoreboardData.teams[team];

            var teamName = instance.lookup.teamName(instance.data.latestScoreboardData.gameMode, teamObject.status);

            var skillStats = [teamName + ' skill'];
            var kdStats = [teamName + ' kd'];

            for (var player in teamObject.players)
            {
                //instance.debug("Looping player in sbdata players");
                var playerObject = teamObject.players[player];
                var personaId = playerObject.personaId;

                skillStats.push(instance.playerStats[personaId].overviewStats.skill);
                kdStats.push(instance.playerStats[personaId].overviewStats.kdRatio);
            }

            teamPlot.push(skillStats, kdStats);
            teamNames[teamName + " skill"] = teamName + ' kd'; 
        }


        //instance.debug(teamPlot);

        instance.data.charts.skillDistribution = c3.generate({
            bindto: '#as-charting-container',
            data : {
                xs: teamNames,
                columns: teamPlot,
                type: 'scatter'
            },
            axis: {
                x: {
                    label: 'KD Ratio',
                    min: 0,
                    tick: {
                        fit: false,
                        centered: true
                    }
                },
                y: {
                    label: 'Skill',
                    min: 0,
                },
            },
            tooltip: {
                format: {
                    title: function (d) { return 'Data' + teamNames[0]; },
                }
            },
        })
    },

    /**
	 * Refreshes all data and redraws scoreboard 
	 *
	 * @param instance			Plugin object instance
	 *
	 */
    updateAll : function(instance){

        var serverInfo = instance.getServerAttributes(); // Server attributes

        instance.queryServerScoreboard(serverInfo, function(queryResult)
        {
            if (queryResult.gameMode == 32) {
                queryResult.teams.pop();
                queryResult.teams.pop();
            }

            // UI Indicator

            $("#as-live-indicator").css({ "background-color": "green" });
            setTimeout(function() {$("#as-live-indicator").css
                $("#as-live-indicator").css({ "background-color": "#78c753" })
            }, 250);

            //instance.debug(queryResult);

            //Store the result of the query
            instance.data.latestScoreboardData = queryResult;

            //Cache player statistics
            instance.updatePlayerStats(instance, queryResult);

            //Update tracker
            instance.updateTracker(instance, queryResult, function(instance)
            {
                instance.updateCharts(instance);
            });

            //Render the scoreboard with this data
            if( !instance.data.scoreboard.animationActive && instance.data.mode == 'scoreboard' )
            {
                if( instance.data.drawMode == "player" ) {
                    instance.scoreboard.drawPlayers(instance, queryResult);
                } 
                else if ( instance.data.drawMode == "squad" ) {
                    instance.scoreboard.drawSquads(instance, queryResult); // Draw the scoreboard using the query result
                } else if ( instance.data.drawMode == "role" ) {
                    instance.scoreboard.drawVehicles(instance, queryResult);
                }
                else if ( instance.data.drawMode == "charts" ) {
                    instance.updateTracker(instance, queryResult, function(instance)
                    {
                        instance.updateCharts(instance);
                    });
                }
            }


        });
    },

    /**
	 * Redraws HTML without refreshing data sources
	 *
	 * @param instance			Plugin object instance
	 *
	 */
    updateHTML : function(instance) {

        if(!instance.data.scoreboard.animationActive && instance.data.mode == 'scoreboard')
        {
            if(instance.data.drawMode == "player") 
            {
                instance.scoreboard.drawPlayers(instance, instance.data.latestScoreboardData);
            } else if ( instance.data.drawMode == "role" ) {
                instance.scoreboard.drawVehicles(instance, instance.data.latestScoreboardData);
            } else if (instance.data.drawMode == "squad") {
                instance.scoreboard.drawSquads(instance, instance.data.latestScoreboardData); // Draw the scoreboard using the query result
            }
        }
    },

    /**
     * Updates the tracking object with data from the server
     *
     * @param instance          Plugin object instance
     * @param serverData        Data from the server
     * @param callback          Callback function
     */
    updateTracker : function(instance, serverData, callback)
    {
        for(i = 0; i < serverData.teams.length; i++)
        {
            var team = serverData.teams[i];
            var teamId = team.status.teamId;
            var tickets = team.status.tickets;

            if( instance.data.tracker.tickets.hasOwnProperty(teamId) )
            {
                instance.data.tracker.tickets[teamId].push(tickets);
            }
            else
            {
                instance.data.tracker.tickets[teamId] = [instance.lookup.teamName(serverData.gameMode, team.status), tickets];
            }
        }
        //instance.debug(instance.data.tracker);
        callback(instance);
    },

    /**
     * Updates the charts
     *
     * @param instance          Plugin object instance
     */

    updateCharts : function(instance) 
    {
        if( instance.data.ticketsChart ) {
            var chartData = [];
            console.log("Here is instance.data.tracker.tickets");
            console.log(instance.data.tracker.tickets);
            for (var teamId in instance.data.tracker.tickets) {
                var team = instance.data.tracker.tickets[teamId];
                var teamName = team[0];
                var records = team.length - 1;

                if (records <= 50) {
                    chartData.push(team);
                } else {
                    chartData.push([teamName].concat(team.slice(-50)));
                }

            }


            instance.data.ticketsChart.load({
                columns : chartData
            });
        }
    },


    /**
    * Returns an object containing the team data for the round and the total stats for each team
    *
    * @param instance           Plugin Object Instance
    * @param scoreboardData     JSON Object containing the information received from the gameserver
    */
    calculateTeamTotals : function(instance, scoreboardData) {
        var s = scoreboardData;
        console.log("Gimme commander feature pls");
        console.log(s);
        var teams = [];
        for (var i = 0; i < s.teams.length; i++) {
            var team = s.teams[i];
            var players = team.players;
            var status = team.status;

            // Object holding team specific statistics
            var teamObj = {
                'players': [],
                'status': team.status,
                'totalPlayers': 0,
                'totalRank': 0,
                'totalKills': 0,
                'totalDeaths': 0,
                'totalScore': 0,
                'playersLoaded': 0,
                'totalPDisplayStat': 0,
                'globalStats': {
                    'totalKd': 0,
                    'totalResetKd': 0,
                    'totalKills': 0,
                    'totalDeaths': 0,
                    'totalSkill': 0,
                    'totalScorePerMinute': 0,
                    'totalKillsPerMinute': 0
                },
                'commander': false
            };

            for (var j = 0; j < team.players.length; j++) {
                var player = team.players[j];
                // Object holding player specific statistics
                var playerObj = {
				    'id': player.personaId,
				    'tag': player.tag,
				    'name': player.name,
				    'rank': player.rank,
				    'role': player.role,
				    'squad': player.squad,
				    'score': player.score,
				    'kills': player.kills,
				    'deaths': player.deaths,
				    'kd': (player.deaths == 0) ? player.kills : player.kills / player.deaths,
				    'globalStats': {
				        'kd': 0,
				        'resetKd': 0,
				        'kills': 0,
				        'deaths': 0,
				        'skill': 0,
				        'scorePerMinute': 0,
				        'killsPerMinute': 0,
				    },
				    'statsLoaded': false,
				    'pDisplayStat': 0
                }

                // This player is a commander
                if (player.role == 2) {
                    teamObj.commander = playerObj;
                } else {
                    // Increment the team's statistics
                    teamObj.totalRank += player.rank;
                    teamObj.totalKills += player.kills;
                    teamObj.totalDeaths += player.deaths;
                    teamObj.totalScore += player.score;
                    teamObj.totalPlayers++;

                    // Check that the player's global statistics have been fetched
                    if (instance.playerStats.hasOwnProperty(player.personaId)) {
                        playerObj.statsLoaded = true;

                        var pStats = instance.playerStats[player.personaId];
                        
                        // Here is where we choose which stats to add to our totals

                        playerObj.globalStats.kills = pStats.overviewStats.kills;
                        playerObj.globalStats.deaths = pStats.overviewStats.deaths;
                        playerObj.globalStats.kd = pStats.overviewStats.deaths == 0 ? pStats.overviewStats.kills : (pStats.overviewStats.kills / pStats.overviewStats.deaths);
                        playerObj.globalStats.resetKd = pStats.overviewStats.kdRatio;
                        playerObj.globalStats.skill = pStats.overviewStats.skill;
                        playerObj.globalStats.scorePerMinute = pStats.overviewStats.scorePerMinute;
                        playerObj.globalStats.killsPerMinute = pStats.overviewStats.killsPerMinute;

                        var displayStat = instance.storage('displayStat');
                        // Calculate the values/totals for the custom statistic column
                        // (REFACTOR) (This logic can be done on the display side)
                        switch (instance.storage('displayStat')) {
                            case 'kdRatio':
                                if (instance.storage('useResetKdr')) {
                                    playerObj.pDisplayStat = pStats.overviewStats.kdRatio;
                                } else { //Calculate the real global KD Ratio using the player's total deaths/total kills
                                    playerObj.pDisplayStat = pStats.overviewStats.deaths == 0 ? pStats.overviewStats.kills : (pStats.overviewStats.kills / pStats.overviewStats.deaths);
                                }
                                break;
                            case 'strength':
                                //Placeholder formula for player strength
                                var playerStrength = (((pStats.overviewStats.killsPerMinute * pStats.overviewStats.kdRatio) * 10) + ((pStats.overviewStats.skill * pStats.overviewStats.scorePerMinute) / 10000)) * 10;
                                playerObj.pDisplayStat = Math.floor(playerStrength);
                                break;
                            default:
                                playerObj.pDisplayStat = pStats.overviewStats[displayStat];
                                break;
                        }
                        teamObj.totalPDisplayStat += playerObj.pDisplayStat;

                        //Add player's global stats to the total
                        teamObj.globalStats.totalKills += playerObj.globalStats.kills;
                        teamObj.globalStats.totalDeaths += playerObj.globalStats.deaths;
                        teamObj.globalStats.totalKd += playerObj.globalStats.kd;
                        teamObj.globalStats.totalResetKd += playerObj.globalStats.resetKd;
                        teamObj.globalStats.totalSkill += playerObj.globalStats.skill;
                        teamObj.globalStats.totalScorePerMinute += playerObj.globalStats.scorePerMinute;
                        teamObj.globalStats.totalKillsPerMinute += playerObj.globalStats.killsPerMinute;

                        teamObj.playersLoaded++;

                    }
                    teamObj.players.push(playerObj);
                }

            }
            teams.push(teamObj);
        }
        return teams;
    },

    /**
     * Returns an object detailing the role speciailizations of the team. This method polls the additional vehicle stats page to ensure all vehicle data is present.
     * 
     * @param   instance            Plugin instance
     * @param   scoreboardData      JSON Object cotnaining the information received from the gameserver
     * @param   callback            Function executed on success (once all statistics are loaded)
     * 
     */
    calculateDetailedRoles : function(instance, scoreboardData, callback) {
        var s = scoreboardData;
        instance.updatePlayerVehicleStats(instance, scoreboardData, function(vehicleData) {
            // We now have complete vehicle data for the entire team (accessible also in instance.playerVehicleStats)
            console.log(vehicleData);
            var teamVehicleStats = [];
            for (var teamId in s.teams) {
                var team = s.teams[teamId];
                var teamVehicles = {};
                for (var playerId in team.players) {
                    var player = team.players[playerId];
                    if (!instance.playerVehicleStats.hasOwnProperty(player.personaId)) {
                        continue;
                    }
                    var playerStats = instance.playerStats[player.personaId];
                    var playerVehicleStats = instance.playerVehicleStats[player.personaId].mainVehicleStats;

                    for (var vehicleId in playerVehicleStats) {
                        var vehicle = playerVehicleStats[vehicleId];

                        if (vehicle.kills == 0) {
                            continue;
                        }

                        if (!teamVehicles.hasOwnProperty(vehicle.category)) {
                            teamVehicles[vehicle.category] = {
                                players: {},
                                totalKills: 0,
                                totalTime: 0,
                                guid: vehicle.guid
                            }
                        }

                        if (!teamVehicles[vehicle.category].players.hasOwnProperty(player.personaId)) {
                            var vehicleStats = {
                                personaId: player.personaId,
                                name: playerStats.name,
                                vehiclesDestroyed: vehicle.destroyXinY,
                                roundStats: player,
                                kills: vehicle.kills,
                                time: vehicle.timeIn,
                                stars: vehicle.serviceStars
                            }
                            teamVehicles[vehicle.category].players[player.personaId] = vehicleStats
                        } else {
                            teamVehicles[vehicle.category].players[player.personaId].vehiclesDestroyed += vehicle.destroyXinY;
                            teamVehicles[vehicle.category].players[player.personaId].kills += vehicle.kills;
                            teamVehicles[vehicle.category].players[player.personaId].time += vehicle.timeIn;
                        }

                        teamVehicles[vehicle.category].totalKills += vehicle.kills;
                        teamVehicles[vehicle.category].totalTime += vehicle.timeIn;
                    }

                }
                // Cull any vehicle categories with less than 100 kills

                for (var teamVehicleName in teamVehicles) {
                    var teamVehicle = teamVehicles[teamVehicleName];
                    if (teamVehicle.totalKills < 100) {
                        delete teamVehicles[teamVehicleName];
                    } 
                }
                teamVehicleStats.push(teamVehicles);
            }

            callback(teamVehicleStats);
        });
 

    },

    /**
    * Returns an object detailing the role specializations of the team. i.e. top players by vehicle type/weapon type
    *
    * @param instance           Plugin Object Instance
    * @param scoreboardData     JSON Object cotnaining the information received from the gameserver
    */
    calculateRoles : function(instance, scoreboardData) {

        var s = scoreboardData;
        var vehicleData = [];
        //instance.debug("Starting roles calc");
        
        for (teamId in s.teams) {
            var team = s.teams[teamId];
            var hasCommander = false;
            var teamVehicles = {};

            for (playerId in team.players) {
                var player = team.players[playerId];
                //Check that the player's stattistics are loaded
                if (!instance.playerStats.hasOwnProperty(player.personaId)) {
                    continue;
                }
                var pStats = instance.playerStats[player.personaId];
                var playerVehicles = pStats.topVehicles;
                //Iterate the player's top vehicles and add them to the team's total
                for (var i = 0; i < playerVehicles.length; i++) {
                    var vehicle = playerVehicles[i];
                    //Limits the kills at 100 to prevent clutter
                    if (vehicle.kills < 100) {
                        continue;
                    }

                    //If first instance of this vehicle category, create it
                    if (!teamVehicles.hasOwnProperty(vehicle.category)) {
                        teamVehicles[vehicle.category] = {
                            players : {},
                            totalKills : 0,
                            totalTime : 0,
                            guid : vehicle.guid
                        };                        
                    }

                    //Add player's stats to the total
                    if (teamVehicles[vehicle.category].players.hasOwnProperty(player.personaId)) {
                        var playerVehicleStats = teamVehicles[vehicle.category].players[player.personaId];
                        playerVehicleStats.kills += vehicle.kills;
                        playerVehicleStats.timeIn += vehicle.timeIn;
                        playerVehicleStats.vehiclesDestroyed += vehicle.destroyXinY; 
                    } else {
                        teamVehicles[vehicle.category].players[player.personaId] = {
                            roundStats : player,
                            kills : vehicle.kills,
                            timeIn : vehicle.timeIn,
                            vehiclesDestroyed : vehicle.destroyXinY
                        };
                    }
                }

            }
            vehicleData.push(teamVehicles);            
        }
        console.log(vehicleData);
        return vehicleData;
    },

    //Updates the round header
    updateRoundHeader : function(instance, s) 
    {

        var totalPlayers = 0;
        console.log("updating header");
        console.log(s);
        for (var i = 0; i < s.teams.length; i++)
        {
            var team = s.teams[i];
            totalPlayers += team.players.length;
        }
        $("#as-server-players").html(totalPlayers + '/' + s.maxPlayers + (s.queueingPlayers > 0 ? '[' + s.queueingPlayers + ']' : ''));
    },
    /**
 	 * Creates HTML detailing expanded player statistics available in their overview stats.
 	 *
 	 * @param  instance    Plugin instance
 	 * @param  personaId   The Persona ID of the player
     * @param  displayDefault  If the HTML should be hidden by default     
 	 */
    createAdvancedPlayerView : function(instance, personaId, displayDefault) {
        //If statistics have not been retrieved just return a basic loader
        if (!instance.playerStats.hasOwnProperty(personaId)) {			
            var html = '<div class="loader small"></div></div></td></tr>'
            
            return html;
        }

        var playerStats = instance.playerStats[personaId];

        var playerName = playerStats.name;

        if (playerStats.activeEmblem) {
            var emblemPath = playerStats.activeEmblem.cdnUrl;
            emblemPath = emblemPath.replace('[SIZE]', '128');
            emblemPath = emblemPath.replace('[FORMAT]', 'png');
        }


        var html = '<tr class="as-scoreboard-advanced-stats-row"><td colspan="7">' +
        '<div class="as-advanced-player-view"' + (displayDefault ? '' : ' style="display:none"') + '>';
        
        //Player name, gravatar, and emblem]
        html += '<div class="as-ao-header"><span id="as-ao-name">' + playerName + (playerStats.activeEmblem ? '</span><img class="as-ao-emblem" src="' + emblemPath + '"></img>' : '') +
            '<button id="as-ao-join" persona-id="' + personaId + '" class="as-ao-btn btn btn-primary">Join Player</button>' +
            '<button id="as-ao-radar" persona-id="' + personaId + '" class="as-ao-btn btn btn-primary">Add to Radar</button>' +
            '</div>';
    
        //Table detailing the player's basic statistics, kills/deaths/etc

        var secondsPlayed = playerStats.overviewStats.timePlayed;
        var minutesPlayed = secondsPlayed/60;
        var hoursPlayed = minutesPlayed/60;

        var timePlayed = Math.floor(hoursPlayed) + 'H ' + Math.round((hoursPlayed - Math.floor(hoursPlayed)) * 60) + 'M';

        html += '<table class="as-stats-overview">' +
            '<tr><th>Kills</th><th>Deaths</th><th>Skill</th><th>Accuracy</th></tr>' +
            '<tr>' +
                '<td>' + instance.commaFormat(playerStats.overviewStats.kills) + '</td>' + 
                '<td>' + instance.commaFormat(playerStats.overviewStats.deaths) + '</td>' + 
                '<td>' + playerStats.overviewStats.skill + '</td>' + 
                '<td>' + playerStats.overviewStats.accuracy.toFixed(2) + '% </td>' + 
            '</tr>' +
            '<tr><th>K/D</th><th>KPM</th><th>SPM</th><th>Time</th></tr>' +
            '<tr>' + 
                '<td>' + (playerStats.overviewStats.kills/playerStats.overviewStats.deaths).toFixed(2) + '</td>' +
                '<td>' + playerStats.overviewStats.killsPerMinute + '</td>' +
                '<td>' + playerStats.overviewStats.scorePerMinute + '</td>' +
                '<td>' + timePlayed + '</td>' +
            '</tr>' +
            '</table>';
        
        //Table detailing the player's top three vehicles
        html += '<table class="as-role-stats as-vehicle-stats">' +
            '<tr><th>Vehicle</th><th>Kills</th><th>KPM</th></tr>';
        for (var vehicleId in playerStats.topVehicles) {
            var vehicle = playerStats.topVehicles[vehicleId];
            var vehicleName = vehicle.slug;
            var vehicleKpm = vehicle.timeIn > 0 ? (vehicle.kills/(vehicle.timeIn/60)).toFixed(2) : '--';
            var vehicleImageClass = instance.battlelog.getVehicleImage(vehicle.guid, 0);
            html += '<tr><td>' + vehicleName.toUpperCase() + '<div class="as-table-role vehicle xsmall ' + vehicleImageClass + ' image"></div></td><td>' + instance.commaFormat(vehicle.kills) + '</td><td>' + vehicleKpm + '</tr>';
        }
        html += '</table>';

        //The same for weapons
        html += '<table class="as-role-stats as-weapon-stats">' +
            '<tr><th>Weapon</th><th>Kills</th><th>Accuracy</th></tr>';
        for (var weaponId in playerStats.topWeapons) {
            var weapon = playerStats.topWeapons[weaponId];
            var weaponName = weapon.slug;
            var weaponImageClass = instance.battlelog.getWeaponImage(weapon.guid, 0);
            html += '<tr><td>' + weaponName.toUpperCase() + '<div class="as-table-role weapon xsmall ' + weaponImageClass + ' image"></div></td><td>' + instance.commaFormat(weapon.kills) + '</td><td>' + ((weapon.shotsHit / weapon.shotsFired) * 100).toFixed(2) + '%</tr>';
        
        }
        html += '</table>'
        html += '</div></td></tr>';

        return html;

        //Top kits
        var topKits = '<table class="table as-advanced-overview-top-kits">' +
		'<tr><th><div class="kit-icon xsmall kit-1"></div></th><th><div class="kit-icon xsmall kit-2"></div></th><th><div class="kit-icon xsmall kit-32"></div></th><th><div class="kit-icon xsmall kit-8"></div></th></tr>' +
		'<tr><td>' + playerStats.overviewStats.serviceStars["1"] + '</td><td>' + playerStats.overviewStats.serviceStars["2"] + '</td><td>' + playerStats.overviewStats.serviceStars["32"] + '</td><td>' + playerStats.overviewStats.serviceStars["8"] + '</td>' +
	    '</table>';


        //Stats overviewhttp://battlelog.battlefield.com/bf4/platoons/view/3353238464465530114/

        console.log(playerStats);
        //Viewport
        //html += '<div class="as-ao-view">';



        html += topKits;

        html += '</div>'

        //Overview Stats


        //Overview Table
	
        html += '<div class="as-advanced-overview-top-roles">' +
        '<table class="table as-advanced-overview-top-vehicles">' +
        '<tr><th colspan="2">Vehicle</th><th>Kills</th><th>KPM</th></tr>';


        //Top vehicles
        $.each(playerStats.topVehicles, function (id, vehicle) {

            //Get vehicle name for image

            var vehicleDisplay = window.items.game_data.compact.vehicles[vehicle.guid];
            vehicleDisplay = vehicleDisplay.see[0];

            var lineartSlug = window.items.game_data.compact.vehicles[vehicleDisplay];
            lineartSlug = lineartSlug.imageConfig.slug;
            console.log(vehicle);

            html += '<tr><td>' + vehicle.slug.toUpperCase() + '</td><td><div class="vehicle xsmall ' + lineartSlug + ' image"></div></td><td>' + instance.commaFormat(vehicle.kills) + '</td><td>' + (vehicle.kills/(vehicle.timeIn/60)).toFixed(2) + '</td></tr>'
        });

        html += '</table><table class="table as-advanced-overview-top-weapons">' +
        '<tr><th colspan="2">Weapon</th><th>Kills</th><th>Accuracy</th></tr>';

        $.each(playerStats.topWeapons, function(id, weapon){

            //Get vehicle name for image

            var weaponDisplay = window.items.game_data.compact.weapons[weapon.guid];
            weaponDisplay = weaponDisplay.see[0];

            var lineartSlug = window.items.game_data.compact.weapons[weaponDisplay];
            lineartSlug = lineartSlug.imageConfig.slug;

            html += '<tr><td>' + weapon.slug.toUpperCase() + '</td><td><div class="weapon xsmall ' + lineartSlug + ' image"></div></td><td>' + instance.commaFormat(weapon.kills) + '</td><td>' + ((weapon.shotsHit / weapon.shotsFired) * 100).toFixed(2) + '%</td></tr>'

        });

        html += '</table></div>';
        

        html += '</div>'

        //End of as-ao-stats


        //Get Dogtag Information

        var dogtagBasic = playerStats.dogTagBasic.imageConfig.slug;
        var dogtagAdvanced = playerStats.dogTagAdvanced.imageConfig.slug;

        html += '</div>';

        return html;

    },

    //Draw the advanced statistics overview 

    drawAdvancedStats : function (instance, personaId) {

        //The player's stats
        var player = instance.playerStats[personaId];

        
        var playerVehicleStats = {};
        instance.loadPlayerVehicleStats(personaId, function (data) {
            playerVehicleStats = data.data;
        });

        var playerWeaponStats = {};
        instance.loadPlayerWeaponStats(personaId, function (data) {
            playerWeaponStats = data.data;
            
            $("#as-container").fadeOut('slow', function () {
                var html = '<div id="as-stats-container">' + '<button class="as-stats-close">Back</button>';

                html += '<h3>' + player.name + '</h3>';

                html += '<div class="as-stats-selectors"><button class="btn as-stats-select-weapons">Weapons</button><button class="btn as-stats-select-vehicles">Vehicles</button></div>';

                //Container to list possible cheating flags

                html += '<div class="as-stats-overview">'

                html += '<div class="as-stats-weapons">' +
                '<table class="table as-stats-weapons-table">';
               
                html += '<tr><th>Weapon</th><th>Kills</th><th>Accuracy</th><th>HSKR</th><th>KPM</th></tr>';

                for (var i = 0; i < playerWeaponStats.mainWeaponStats.length; i++) {

                    if (weapon.kills > 100) {
                        var weaponDisplay = window.items.game_data.compact.weapons[weapon.guid];
                        weaponDisplay = weaponDisplay.see[0];
                        var lineartSlug = window.items.game_data.compact.weapons[weaponDisplay];
                        lineartSlug = lineartSlug.imageConfig.slug;

                        var w_accuracy = 0;
                        if (weapon.shotsFired > 0 &&  weapon.shotsHit > 0) {
                            w_accuracy = (weapon.shotsHit / weapon.shotsFired) * 100;
                        }

                        var w_kpm = 0;
                        if (weapon.kills > 0 && weapon.timeEquipped > 0) {
                            w_kpm = (weapon.kills / (weapon.timeEquipped / 60));
                        }

                        var w_hskr = 0;
                        if (weapon.kills > 0 && weapon.headshots > 0) {
                            w_hskr = ((weapon.headshots / weapon.kills) * 100);
                        }

                        html += '<tr class="as-stats-weapon"><td><div class="weapon xsmall ' + lineartSlug + ' image"></div><div>' + weapon.slug.toUpperCase() + '</div></td><td>' + weapon.kills + '</td><td>' + w_accuracy.toFixed(2) + '%</td><td>' + w_hskr.toFixed(2) + '%</td><td>' + w_kpm.toFixed(2) + '</td></tr>';
                        console.log(weapon.slug);
                        console.log(weapon);
                    }
                }
                html += '</table></div><div class="as-stats-vehicles" style="display: none;"><table class="table as-stats-vehicles-table">';
                html += '<tr><th>Vehicle</th><th>Kills</th><th>Vehicles Destroyed</th><th>KPM</th><th>Time</th></tr>';
                console.log(playerVehicleStats);

                for (var i = 0; i < playerVehicleStats.mainVehicleStats.length; i++) {
                    var vehicle = playerVehicleStats.mainVehicleStats[i];

                    if (vehicle.kills > 100) {
                        var vehicleDisplay = window.items.game_data.compact.vehicles[vehicle.guid];
                        vehicleDisplay = vehicleDisplay.see[0];
                        var lineartSlug = window.items.game_data.compact.vehicles[vehicleDisplay];
                        lineartSlug = lineartSlug.imageConfig.slug;

                        var v_vehiclesDestroyed = 0;
                        if (vehicle.destroyXinY > 0) {
                            v_vehiclesDestroyed = vehicle.destroyXinY;
                        }

                        var v_kpm = 0;
                        if (vehicle.timeIn > 0 && vehicle.kills > 0)
                        {
                            v_kpm = (vehicle.kills / (vehicle.timeIn / 60));
                        }

                        var v_time = (vehicle.timeIn / 60).toFixed(2);



                        html += '<tr class="as-stats-vehicle"><td><div class="vehicle xsmall ' + lineartSlug + ' image"></div><div>' + vehicle.slug.toUpperCase() + '</div></td><td>' + vehicle.kills + '</td><td>' + v_vehiclesDestroyed + '</td><td>' + v_kpm.toFixed(2) + '%</td><td>' + v_time + '</td></tr>';

                    }
                }

                html += '</table></div></div>';

                $("#serverbrowser-page").after(html);
                console.log(playerWeaponStats);
                console.log(playerVehicleStats);
            });

        });



    },
    
    /* 
     * Builds HTML for the runtime options
     * 
     * @param   instance        Plugin instance
     * 
     */
    getRuntimeOptions : function(instance) {
        var selection = {
            'kdRatio': 'KD (G)',
            'strength': 'Strength',
            'skill': 'Skill'
        }

        var html = '<select id="as-select-stat">'

        for (var stat in selection) {
            var value = stat;
            var name = selection[stat];

            html += '<option value="' + value + '">' + name + '</option>';
        }

        html += '</select>';

        return html;
    },

    drawSettings : function(instance) {
        var html = '<div id="as-settings-container"><header class="as-settings-header"><h1>' + instance.t("settings-title") + '</h1></header>' +
            '<div id="as-settings-options">';

        //Get the settings
        console.log(instance.storage('hilightingEnabled'));
        var hilightingEnabled = instance.storage('hilightingEnabled') ? (instance.storage('hilightingEnabled') == true ? true : false) : false;


        /** Check box for the live update **/

        html += '<table class="as-settings-table">' +
            '<tr><td class="as-settings-table-header" colspan="3">General</td></tr>' +
            '<tr><th>Live Scoreboard</th><td>' +
            '<div class="switch-container pull-right clearfix">' +
                '<div class="switch pull-left">' +
                    '<input type="checkbox" id="as-enable-live" name="as-enable-live" value="' + instance.storage('liveEnabled').toString() + '" ' + (instance.storage('liveEnabled') == true ? 'checked' : '') + '>' +
                '<div class="handle"></div>' +
                '</div>' +
            '</div></td>' +
            '<td class="option-description">Determines whether or not the scoreboard automatically updates as the game progresses</td>' +
            '</tr>' +
            '<tr><th>Hilighting</th><td>' +
            '<div class="switch-container pull-right clearfix">' +
                '<div class="switch pull-left">' +
                    '<input type="checkbox" id="as-enable-hilighting" name="as-enable-hilighting" value="' + hilightingEnabled.toString() + '" ' + (hilightingEnabled == true ? 'checked' : '') + '>' +
                '<div class="handle"></div>' +
                '</div>' +
            '</div></td>' +
            '<td class="option-description">Enables hilighting based off the strength of player statistics</td>' +
            '</tr>' +
            '<tr><th>Polling Rate (ms)</th><td><input id="as-polling-rate" type="number" name="as-polling-rate" value="5000"></td>' +
            '<td class="option-description">The frequency the scoreboard queries the gameserver for information. 5000ms is the default</td>' +
            '</tr>' +
            '<tr><th>Debug Information</h><td>' +
            '<div class="switch-container pull-right clearfix">' +
                '<div class="switch pull-left">' +
                    '<input type="checkbox" id="as-enable-debugging" name="as-enable-debugging" value="' + instance.storage('debuggingEnabled').toString() + '" ' + (instance.storage('debuggingEnabled') == true ? 'checked' : '') + '>' +
                '<div class="handle"></div>' +
                '</div>' +
            '</div></td>' +
            '<td class="option-description">Enable debugging window</td>' +
            '</tr>' +
            '<tr><td class="as-settings-table-header" colspan="3">Statistics</td></tr>' +
            '<tr><th>Detailed Vehicle Overview</th><td>' +
            '<div class="switch-container pull-right clearfix">' +
                '<div class="switch pull-left">' +
                    '<input type="checkbox" id="as-detailed-vehicles" name="as-detailed-vehicles" value="' + instance.storage('detailedVehicles').toString() + '" ' + (instance.storage('detailedVehicles') == true ? 'checked' : '') + '>' +
                '<div class="handle"></div>' +
                '</div>' +
            '</div></td>' +
            '<td class="option-description">Gives a more complete view of vehicle stats. <br> Warning: Enabling this option will increase the number of requests sent to Battlelog</td>' +
            '</tr>' +
            '<tr><th>Vehicle Kill Threshold</th>' + 
            '<td><input type="number" name="as-vehicle-threshold" id="as-vehicle-threshold" value="' + instance.storage('vehicleThreshold').toString() + '" /></td>' +
            '<td class="option-description">The number of kills a player must have in a given vehicle to appear in the vehicle overview.</td>' +
            '</tr>';


        html += '</table>';

        /** Input field for polling rate **/

        /** Check box for hilighting **/


        $('#as-scoreboard-container').html(html);
    },
    /**
	 * Draws settings HTML
	 *
	 */
    renderSettings : function(instance){
        var html = '';
        html += '<div id="advs_scoreboard_settings">';
        html +=	'<h4 class="advs_title">' + instance.t("settings-title") + '</h4>';
		
        /** Check box for live update **/

        html += '<div class="as-settings-option"><label class="as-settings-label" for="as-enable-live">Live Scoreboard</label>';

        html += '<input id="as-enable-live" type="checkbox" name="as-enable-live" value="'+ instance.storage('liveEnabled').toString() +'" '+ (instance.storage('liveEnabled') == true ? 'checked' : '') + '>';

        html += '</div>';

        /** Check box for hilighting **/

        html += '<div class="as-settings-option"><label class="as-settings-label" for="as-enable-hilighting">Enable Hilighting</label>';

        html += '<input id="as-enable-hilighting" type="checkbox" name="as-enable-hilighting" value="'+ instance.storage('hilightingEnabled').toString() +'" '+ (instance.storage('hilightingEnabled') == true ? 'checked' : '') + '>';

        html += '</div>';

        /** Check box for hilighting friends **/

        html += '<div class="as-settings-option"><label class="as-settings-label" for="as-enable-friend-hilighting">Hilight Friends</label>';

        html += '<input id="as-enable-friend-hilighting" type="checkbox" name="as-enable-friend-hilighting" value="'+ instance.storage('hilightFriends').toString() +'" '+ (instance.storage('hilightFriends') == true ? 'checked' : '') + '>';

        html += '</div>';


        /** **/
		
        html += '<div class="as-about" style="font-size: 10px;"><p>Advanced Scoreboard 0.1.1 Beta</p><p>Developed by Cr1N</p></div>';

        html += '</div>';

        $("#content").append(html);
    },

    drawSelectors : function(instance) {
        
        var selectors = [
            { htmlId: 'as-show-players', htmlText: 'Players', drawMode: 'player' },
            { htmlId: 'as-show-squads', htmlText: 'Squads', drawMode: 'squad' },
            { htmlId: 'as-show-roles', htmlText: 'Vehicles', drawMode: 'role' },
            { htmlId: 'as-show-charts', htmlText: 'Charts', drawMode: 'charts' },
        ];

		selectorHtml = "";
        for (var i = 0; i < selectors.length; i++) {
            var selector = selectors[i];
            selectorHtml += '<a class="view-selector ' + (instance.data.drawMode === selector.drawMode ? 'view-selector-active' : '') + '" id="' + selector.htmlId + '">' + selector.htmlText + '</a>';
        }

        selectorHtml += '<a class="view-selector" id="as-settings">Settings</a>';

        return selectorHtml;

    },

	/**
	 * Simple debugging
	 *
     * @param   instance    Plugin instance
	 * @param	type	    Type of debug information, message, error, information
     * @param   msg         The debug message or array to display
	 */
	debug : function(instance, type, msg) {
        //Only output if debugging is expressly enabled
		if (instance.storage('debuggingEnabled')) {
            //Ensure debugging window is present
            var debugWindow = $("#as-debug-output");
            console.log("Debugging event fired");
            console.log(debugWindow);

            //Get time

            var currentDate = new Date();
            var currentTime = ('0'+currentDate.getHours()).slice(-2) + ':' + ('0'+currentDate.getMinutes()).slice(-2) + ':' + ('0'+currentDate.getSeconds()).slice(-2);

            switch (type) {
                case 0:
                    debugWindow.append('<p class="as-debug-information"><span class="as-debug-time">[' + currentTime + ']</span><span>' + msg + '</span></p>');
                    console.log('[AdvancedScoreboard][Info] - ' + msg);
                    break;
                case 1:
                    debugWindow.append('<p class="as-debug-success"><span class="as-debug-time">[' + currentTime + ']</span><span>' + msg + '</span></p>');
                    console.log('[AdvancedScoreboard][Success] - ' + msg, 'color: green');
                    break;
                case 2:
                    debugWindow.append('<p class="as-debug-error"><span class="as-debug-time">[' + currentTime + ']</span><span>' + msg + '</span></p>');
                    console.log('[AdvancedScoreboard][Error] - ' + msg, 'color: red');
                    break;
                default:
                    debugWindow.append('<p class="as-debug-information"><span class="as-debug-time">[' + currentTime + ']</span><span>' + msg + '</span></p>');
                    console.log('[AdvancedScoreboard][Success] - ' + msg, 'color: red');
            }
        }
	},


	/**
	 * Returns JSON object containing server attributes extracted from the DOM 
	 *
	 * @return    JSON object containing server data
	 */
	getServerAttributes : function() {

		var $joinMpServerButton = $("#server-page-join-buttons");
   
		var server = {
			ip: $joinMpServerButton.data("ip"),
			gameId: $joinMpServerButton.attr("data-gameid"),
			port: $joinMpServerButton.data("port"),
			game: $joinMpServerButton.data("game"),
			guid: $joinMpServerButton.data("guid")
		};

		return server;
	},

	/**
	 * Returns scoreboard data from the game server 
	 *
	 * @callback callback	Callback function
	 * @param serverInfo    Server information in JSON format
	 *
	 */
	queryServerScoreboard : function(serverInfo, callback) {
		
		launcher.queryServer(serverInfo, function(queryInfo) { 
			if (!queryInfo) {
                instance.debug(instance, 2, 'Could not obtain information from the server')
			} else {
				if(queryInfo.status == "OK") {
					callback(queryInfo.result)
				} else {
					$("#as-scoreboard-container").html('<div class="as-scoreboard-roundfinished">Round is over. Waiting for next round to start...</div>');
					console.log("Round has not started");
				}
			}
		});


	},
    /**
     * 
     * 
     */

	updatePlayerVehicleStats: function(instance, scoreboardData, callback) {
	    var s = scoreboardData;
	    var toLoad = []

	    for (teamId in s.teams) {
	        var team = s.teams[teamId];
	        for (playerId in team.players) {
	            var player = team.players[playerId];
	            if (!instance.playerVehicleStats.hasOwnProperty(player.personaId)) {
	                toLoad.push(player.personaId);
	            }
	        }
	    }

	    if (toLoad.length == 0) {
	        callback(instance.playerVehicleStats);
	        return;
	    }

	    var playersLoaded = 0;
	    // Get the statistics for the individual players
	    for (var i = 0; i < toLoad.length; i++) {
	        var personaId = toLoad[i];
	        instance.loadPlayerVehicleStats(personaId, function(data) {
	            var vehicleStats = data.data;
	            instance.playerVehicleStats[vehicleStats.personaId] = vehicleStats;
	            playersLoaded += 1;
	            if (playersLoaded == toLoad.length) {
	                callback(instance.playerVehicleStats);
	            }
	        })
	    }

	},

    /**
     * Checks for players who don't't have their statistics cached and fetches them
     *
     * @param   scoreboardData  Scoreboard data from the game server
     * @param   instance        Plugin instance
     *
     */
	updatePlayerStats: function (instance, scoreboardData) {
	    var updatePlayers = [];
	    var toLoad = 0;
	    var loaded = 0;
	    //For each team

	    $.each(scoreboardData.teams, function (teamID, team) {
	        $.each(team.players, function (playerId, player) {
	            if (!instance.playerStats.hasOwnProperty(player.personaId)) {
	                toLoad++;
	            }
	        });
	    });
	    $.each(scoreboardData.teams, function (teamID, team)
	    {
            //For each player in the team
	        $.each(team.players, function (playerID, player)
	        {
				//Only load the statistics if they are not already present in the database
	            if (!instance.playerStats.hasOwnProperty(player.personaId)) {
	                var playerName = player.tag ? '[' + player.tag + ']' + player.name : player.name;
	                instance.loadPlayerStats(player.personaId, playerName, function (overviewStats, playerName) {
                        if (overviewStats.data.statsTemplate == 'profile.warsawoverviewpopulate') {
    	                    instance.playerStats[player.personaId] = overviewStats.data;
    	                    instance.playerStats[player.personaId]["name"] = playerName;
    	                    loaded++;
    	                    if (loaded == toLoad) {
    	                        instance.updateHTML(instance);
    	                    }
                        } else { //Stats are down, hacky rework for now
                            console.log(overviewStats);
                            toLoad--;
                        }
					})
				} 
			});

		})
	},


	/**
	 * Return player status
	 *
	 * @callback callback	Callback function
	 * @param personaId		Persona ID of the player to be queried
	 *
	 */
	loadPlayerStats: function (personaId, playerName, callback) {	
		$.ajax({            
			url: "https://battlelog.battlefield.com/bf4/warsawoverviewpopulate/" + personaId + "/1/",
			type: 'GET',
			async: true,
			cache: false,
			timeout: 30000,
			success: function(data) {
			    callback(data, playerName);
			}
		});		
	},

    /**
     * Returns a players weapon stats
     * 
     * @callback    callback    Callback function
     * @param       personaId   Persona ID of the player to fetch
     */
	loadPlayerWeaponStats: function (personaId, callback) {
	    $.ajax({            
	        url: "https://battlelog.battlefield.com/bf4/warsawWeaponsPopulateStats/" + personaId + "/1/stats/",
	        type: 'GET',
	        async: true,
	        cache: false,
	        timeout: 30000,
	        success: function(data) {
	            callback(data);
	        }
	    });	
	},

    /**
     * Returns a players vehicle stats stats
     * 
     * @callback    callback    Callback function
     * @param       personaId   Persona ID of the player to fetch
     */
	loadPlayerVehicleStats : function(personaId, callback) {
	    $.ajax({
	        url: "https://battlelog.battlefield.com/bf4/warsawvehiclesPopulateStats/" + personaId + "/1/stats/",
	        type: 'GET',
	        async: true,
	        cache: false,
	        timeout: 30000,
	        success: function (data) {
	            callback(data);
	        }
	    });
	},




	lookup : {
		displayStat : function(displayStatValue){

			var displayStatsLookup = { 
				'skill' : 'Skill', 
				'kdRatio' : 'K/D (G)', 
				'kills' : 'Kills', 
				'deaths': 'Deaths',
                'strength' : 'Strength'
			};

			return displayStatsLookup[displayStatValue];

		},

		teamName : function(gameMode, status) {

		    if (gameMode == 2) {
		        if (status.teamType == 'attackers') {
		            return 'ATK';
		        } else {
		            return 'DEF';
		        }
		    } else {
		        var factions = ["US", "RU", "CN"];

		        return factions[status.faction];
		    }

		},

		teamType : function(teamId) {

			if(teamId == 1) {
				var type = 'home'
			} else {
				var type = 'away';
			}

			return type;
		},

        teamFlag : function(teamName) 
        {
            var urlPrefix = "https://eaassets-a.akamaihd.net/bl-cdn/cdnprefix/2e8fa20e7dba3f4aecb727fc8dcb902f1efef569b/public/common/flags/";
            if (teamName == "US" || teamName == "RU" || teamName == "CN") {
                return urlPrefix + teamName.toLowerCase() + '.gif';
            } else {
                return false
            }
        },

		squadName : function(squadId) {
			var squads = [
			  "No squad",
			  "Alpha",
			  "Bravo",
			  "Charlie",
			  "Delta",
			  "Echo",
			  "Foxtrot",
			  "Golf",
			  "Hotel",
			  "India",
			  "Juliet",
			  "Kilo",
			  "Lima",
			  "Mike",
			  "November",
			  "Oscar",
			  "Papa",
			  "Quebec",
			  "Romeo",
			  "Sierra",
			  "Tango",
			  "Uniform",
			  "Victor",
			  "Whiskey",
			  "X-ray",
			  "Yankee",
			  "Zulu",
			  "Haggard",
			  "Sweetwater",
			  "Preston",
			  "Redford",
			  "Faith",
			  "Celeste"
			];
			return squads[squadId];
		},
		gameMode: function (mode)
		{
		    var gameModes = { 2: "Rush", 64: "Conquest Large" }
		    if( gameModes.hasOwnProperty(mode) ) {
		        return gameModes[mode];
		    } else {
		        return "Unknown Gamemode";
		    }
		},
	    /*
        * Match the players stat to a hilighting class based on a defined statistic
        *
        */
		hilightingClass : function (displayStat, pDisplayStat) {
	        if (displayStat == 'kdRatio') {
	            if (pDisplayStat < 1) {
	                hilightingType = 'low';
	            } else if (pDisplayStat < 2) {
	                hilightingType = 'average';
	            } else if (pDisplayStat < 3) {
	                hilightingType = 'good';
	            } else if (pDisplayStat < 4) {
	                hilightingType = 'high';
	            } else if (pDisplayStat < 5) {
	                hilightingType = 'v-high';
	            } else if (pDisplayStat >= 5) {
	                hilightingType = 'pro';
	            }
	        } else if (displayStat == 'skill') {
	            if (pDisplayStat < 200) {
	                hilightingType = 'low';
	            } else if (pDisplayStat < 300) {
	                hilightingType = 'average';
	            } else if (pDisplayStat < 400) {
	                hilightingType = 'good';
	            } else if (pDisplayStat < 550) {
	                hilightingType = 'high';
	            } else if (pDisplayStat >= 550) {
	                hilightingType = 'v-high';
	            }
	        }
	        else if (displayStat == 'strength') {
	            if (pDisplayStat < 200) {
	                hilightingType = 'low';
	            } else if (pDisplayStat < 300) {
	                hilightingType = 'average';
	            } else if (pDisplayStat < 400) {
	                hilightingType = 'good';
	            } else if (pDisplayStat < 550) {
	                hilightingType = 'high';
	            } else if (pDisplayStat >= 550) {
	                hilightingType = 'v-high';
	            }
	        }

	        return hilightingType;
        }

	},

    /*
     * Sorts an object by the value of a given field. Returns an ordered array of keys to iterate the object.
     * 
     * @param   object      Object to sort
     * @param   field       The field to sort by
     * @param   order       The order to sort by. Either asc or desc
     */
	sortObject: function(object, field, order) {

	    var keys = [];

	    for (var key in object) {
	        keys.push(key);
        }        

	    keys.sort(function(a, b) {
	        if (object[a][field] < object[b][field])
	            return order == 'desc' ? 1 : -1;
	        if (object[a][field] > object[b][field])
	            return order == 'desc' ? -1 : 1;
	        return 0;
	    });

	    return keys;
    },

	commaFormat : function(number)
	{
		return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	},

	/**
	 *
	 * Unloads plugin by clearing variables and intervals
	 *
	 * @param instance		Plugin Instance
	 */

	unloadPlugin : function(instance) {

		//Clear interval
		if(instance.ticker.isActive) {

			instance.ticker.stop(instance);
		
		}

		//instance.data.latestScoreboardData = {};
		instance.data.advancedViewPlayer = 0;
		instance.data.pluginLoaded = false;
        instance.data.currentChart = false;
        for(var tracked in instance.data.tracker)
        {
            instance.data.tracker[tracked] = {};
        }
	}





});
/**
* True Player Counts - Shows the true player count on the server (Not the ones in queue/cheating with the bots).
* 
* Used I-MrFixIt-I's Friends Highlighter as a base.
* 
* @author xfileFIN
* @version 2.1
* @url https://getbblog.com
*/

/*************/
/* Changelog */
/*************/
/*
Version: 2.1
- Fix: Stop excessive request flooding (hopefully :))
- Fix: Fix match info and scoreboard on battlelog (Thanks DICE for breaking them). And thanks PolloLoco for pointing out that https works even though http doesn't
Version: 2.0
- Change: Fetch data from another place
Version: 1.4
- Fix: Made ajax request async so it won't hang the whole site when the request doesn't work
Version: 1.3
- Added: Color coding on low, mid, high difference of the player count shown/the actual ones playing.
- Added: Option to remove spectators/commanders if there are none. This is to trim down the view.
Version: 1.1
- Fixed a bug that prevented automatic loading on page load (Worked from the Editor but not when uploaded).
Version: 1.0
- Initial release
*/


var instanssi;

// initialize your plugin
BBLog.handle("add.plugin", {

    /**
    * The unique, lowercase id of my plugin
    * Allowed chars: 0-9, a-z, -
    */
    id: "xfilefin-true-playercounts",

    /**
    * The name of my plugin, used to show config values in bblog options
    * Could also be translated with the translation key "plugin.name" (optional)
    *
    * @type String
    */
    name: "True Player Counts",

    /**
    * Some translations for this plugins
    * For every config flag must exist a corresponding EN translation
    *   otherwise the plugin will no be loaded
    *
    * @type Object
    */
    translations: {
        "en": {
            "use.true-playercounts": "Use True Player Counts",
            "use.trim-view": "Trim Spectator/Commander",
            "change-color-high": "Change color (High)",
            "choose-color-high": "Choose a color of your choice. Example: #ff0000",
            "change-color-mid": "Change color (Mid)",
            "choose-color-mid": "Choose a color of your choice. Example: #99b839",
            "change-color-low": "Change color (Low)",
            "choose-color-low": "Choose a color of your choice. Example: #39b54a"
        },
        "de": {
            "use.true-playercounts": "Use True Player Counts",
            "use.trim-view": "Trim Spectator/Commander",
            "change-color-high": "Farbe ändern (High)",
            "choose-color-high": "Wähle eine Farbe deiner Wahl. Beispiel: #ff0000",
            "change-color-mid": "Farbe ändern (Mid)",
            "choose-color-mid": "Wähle eine Farbe deiner Wahl. Beispiel: #99b839",
            "change-color-low": "Farbe ändern (Low)",
            "choose-color-low": "Wähle eine Farbe deiner Wahl. Beispiel: #39b54a"
        }
    },

    stdColorHigh: "#ff0000",
    stdColorMid: "#99b839",
    stdColorLow: "#39b54a",

    /**
    * Configuration Options that appears in the BBLog Menu
    * Every option must be an object with properties as shown bellow
    * Properties available:
    *   key : The name for your config flag - The user can toggle this option
    *         and you can retreive the users choice with instance instance.storage(YOUR_KEY_NAME) (0 or 1 will be returned)
    *   init : Can be 0 or 1 - Represent the initial status of the option when the user load the plugin for the first time
    *          If you want that this option is enabled on first load (opt-out) than set it to 1, otherwise to 0 (opt-in)
    *   handler(optional): When set as a function this config entry turns into a button (like the plugins button you see in the bblog menu)
    *                       The function well be executed when the user clicks the button
    */
    configFlags: [
        { "key": "use.true-playercounts", "init": 1 },
        { "key": "use.trim-view", "init": 0 },
        {
            "key": "change-color-high", "init": 0, "handler": function (instance) {
                var color = prompt(instance.t("choose-color-high"));
                if (color.charAt(0) != "#") {
                    color = + "#";
                }

                var isHexValue = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(color);
                if (isHexValue) {
                    instance.storage("colorHigh", color);
                }
            }
        },
        {
            "key": "change-color-mid", "init": 0, "handler": function (instance) {
                var color = prompt(instance.t("choose-color-mid"));
                if (color.charAt(0) != "#") {
                    color = + "#";
                }

                var isHexValue = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(color);
                if (isHexValue) {
                    instance.storage("colorMid", color);
                }
            }
        },
        {
            "key": "change-color-low", "init": 0, "handler": function (instance) {
                var color = prompt(instance.t("choose-color-low"));
                if (color.charAt(0) != "#") {
                    color = + "#";
                }

                var isHexValue = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(color);
                if (isHexValue) {
                    instance.storage("colorLow", color);
                }
            }
        }
    ],

    /**
    * A handler that be fired immediately (only once) after the plugin is loaded into bblog
    *
    * @param object instance The instance of your plugin which is the whole plugin object
    *    Always use "instance" to access any plugin related function, not use "this" because it's not working properly
    *    For example: If you add a new function to your addon, always pass the "instance" object
    */
    init: function (instance) {
        // some log to the console to show you how the things work
        /*console.log(
            "plugin."+instance.id+".init"
        );*/
        instanssi = instance;
    },

    /**
    * A trigger that fires everytime when the dom is changing but at max only once each 200ms (5x per second) to prevent too much calls in a short time
    * Example Case: If 10 DOM changes happen in a period of 100ms than this function will only been called 200ms after the last of this 10 DOM changes
    * This make sure that all actions in battlelog been finished before this function been called
    * This is how BBLog track Battlelog for any change, like url, content or anything
    *
    * @param object instance The instance of your plugin which is the whole plugin object
    *    Always use "instance" to access any plugin related function, not use "this" because it's not working properly
    *    For example: If you add a new function to your addon, always pass the "instance" object
    */
    domchange: function (instance) {
        instanssi = instance;

        S.globalContext.staticContext.keeperQueryEndpoint = "https://keeper.battlelog.com"
    },
});

$( document ).ready(function() {
    S.globalContext.staticContext.keeperQueryEndpoint = "https://keeper.battlelog.com"
});

// Create a closure
(function () {
    // Your base, I'm in it!
    var originalAddClassMethod = jQuery.fn.addClass;

    jQuery.fn.addClass = function () {
        if(jQuery.inArray("loading-info", arguments) !== -1){
            if (this.hasClass("bblog-serverbrowser-filters")) {
                this.removeClass("bblog-serverbrowser-filters");
            }
        }
        if(jQuery.inArray("bblog-serverbrowser-filters", arguments) !== -1){
            if (!this.hasClass("bblog-serverbrowser-filters")) {
                doTheMagic(this);
            }
        }

        // Execute the original method.
        var result = originalAddClassMethod.apply(this, arguments);

        // trigger a custom event
        jQuery(this).trigger('cssClassChanged');

        // return the original result
        return result;
    }
})();

function doTheMagic(row){
    if (!instanssi.storage("use.true-playercounts")) {
        return;
    }

    if (BBLog.cache("mode") != "bf4" || !serverbrowserwarsaw || !serverbrowserwarsaw.table) {
        return;
    }

    var data = $(row).data("server");
    if (!data) return true;

    // True player count
    var url = "battlelog.battlefield.com/bf4/servers/show/pc/" + data.guid + "?json=1";

    var $serverRow = $(row);
    function showTrueCounts(response) {
        if (response.type == "success" && response.message.SERVER_INFO && response.message.SERVER_PLAYERS) {
            //console.log("Current: " + response.message.SERVER_INFO.slots[2].max + "/" + response.message.SERVER_PLAYERS.length);
            var slotData = response.message.SERVER_INFO.slots;
            var totalPlayers = response.message.SERVER_PLAYERS.length;

            if (slotData[2]) {
                if (!$serverRow.find(".bblog-slots.trueplayercount").length) {
                    if ($serverRow.find(".bblog-slots.commander").length) {
                        $serverRow.find(".bblog-slots.commander").before('<div class="bblog-slots trueplayercount">' + totalPlayers + "/" + slotData[2].max + '</div>');
                    }
                    else if ($serverRow.find(".bblog-slots.spectator").length) {
                        $serverRow.find(".bblog-slots.spectator").before('<div class="bblog-slots trueplayercount">' + totalPlayers + "/" + slotData[2].max + '</div>');
                    }
                    else {
                        $serverRow.find("td.players").append('<div class="bblog-slots trueplayercount">' + totalPlayers + "/" + slotData[2].max + '</div>');
                    }
                }
                else{
                    $serverRow.find(".bblog-slots.trueplayercount").html('<div class="bblog-slots trueplayercount">' + totalPlayers + "/" + slotData[2].max + '</div>');
                }
                var serverplayers = $serverRow.find(".bblog-slots.trueplayercount");

                var difference = Math.abs(slotData[2].current - totalPlayers);
                if (difference <= 2) {
                    if (instanssi.storage("change-color-low")) {
                        var color = instanssi.storage("colorLow");
                        if (color !== null) {
                            $(serverplayers).css("color", color);
                        }
                        else {
                            $(serverplayers).css("color", instanssi.stdColorLow);
                        }
                    }
                    else {
                        $(serverplayers).css("color", instanssi.stdColorLow);
                    }
                }
                else if (difference <= 5) {
                    if (instanssi.storage("change-color-mid")) {
                        var color = instanssi.storage("colorMid");
                        if (color !== null) {
                            $(serverplayers).css("color", color);
                        }
                        else {
                            $(serverplayers).css("color", instanssi.stdColorMid);
                        }
                    }
                    else {
                        $(serverplayers).css("color", instanssi.stdColorMid);
                    }
                }
                else {
                    if (instanssi.storage("change-color-high")) {
                        var color = instanssi.storage("colorHigh");
                        if (color !== null) {
                            $(serverplayers).css("color", color);
                        }
                        else {
                            $(serverplayers).css("color", instanssi.stdColorHigh);
                        }
                    }
                    else {
                        $(serverplayers).css("color", instanssi.stdColorHigh);
                    }
                }
                $(serverplayers).css("font-size", "12px");
            }

            // Remove the unneeded nodes to make the view a bit nicer/cleaner
            if (instanssi.storage("use.trim-view")) {
                if (slotData[4] && $serverRow.find(".bblog-slots.commander").length && slotData[4].current <= 0) {
                    $serverRow.find(".bblog-slots.commander").css("display", "none");
                }
                if (slotData[8] && $serverRow.find(".bblog-slots.spectator").length && slotData[8].current <= 0) {
                    $serverRow.find(".bblog-slots.spectator").css("display", "none");
                }
            }
        }
    }

    // Fetch the current data
    $.ajax({
        async: true,
        url: url,
        error: function () {
            //console.log("Fetching: " + url + " timed out.");
        },
        success: function (result) {
            //console.log(result);
            if (result) {
                showTrueCounts(result);
            }
        },
        timeout: 5000 // sets timeout to 5 seconds
    });
}
