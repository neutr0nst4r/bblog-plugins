/**
* BF4 Advanced Player Links - Add some advanced player links (Anti-Cheat) to the profile.
*
* @author Neutr0nst4r, Original: I-MrFixIt-I + Elementofprgress (ACI)
* @version 2.1
* @url https://battlefield.agency/discord
*/

// initialize your plugin
BBLog.handle("add.plugin", {

    /**
    * The unique, lowercase id of my plugin
    * Allowed chars: 0-9, a-z, -
    */
    id : "neutr0nst4r-bf4-advanced-player-links",

    /**
    * The name of my plugin, used to show config values in bblog options
    * Could also be translated with the translation key "plugin.name" (optional)
    *
    * @type String
    */
    name : "BF4 Advanced Player Links",

    /**
    * Some translations for this plugins
    * For every config flag must exist a corresponding EN translation
    *   otherwise the plugin will no be loaded
    *
    * @type Object
    */
    translations : {
        "en" : {
		"use.player-links" : "Use Advanced Player Links",
		"use.BA" : "Show Battlefield Agency",
		"use.BF4DB" : "Show BF4DB",
		"use.BF4CR" : "Show BF4CheatReport",
		"use.247FairPlay" : "Show 247FairPlay"
        },
        "de" : {
        	"use.player-links" : "Advanced Player Links verwenden",
		"use.BA" : "Battlefield Agency anzeigen",
		"use.BF4DB" : "BF4DB anzeigen",
		"use.BF4CR" : "BF4CheatReport anzeigen",
		"use.247FairPlay" : "247FairPlay anzeigen"
        }
    },

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
    configFlags : [
        {"key" : "use.player-links", "init" : 1},
    	{"key" : "use.BA", "init" : 1},
        {"key" : "use.BF4DB", "init" : 1},
	{"key" : "use.BF4CR", "init" : 1},
	{"key" : "use.247FairPlay", "init" : 1}
    ],

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
    domchange : function(instance){
        if (instance.storage("use.player-links"))
        {
            if(BBLog.cache("mode") == "bf4")
            {
                if (!$( "#advanced-player-links" ).length) {
                    var urlParts = window.location.pathname.replace(/\/+$/, "").split('/');
		    var game = urlParts[1];
                    var personaId = urlParts[urlParts.length - 2];
                    
                    var soldierName = $("#game-stats-head .soldier-info-name span").last().text();
                    var html = "<div id='advanced-player-links' class='box-content no-padding leaderboard-highlight'>";
    
                    html += "<div class='description'>•</div>";
                        
					if (instance.storage("use.BA")) html += "<div class='description'><a href='https://battlefield.agency/player/by-persona_id/" + game + "/" + personaId + "' target='_blank'>Battlefield Agency</a></div>"
										+ "<div class='description'>•</div>";		
                    
                    if (instance.storage("use.BF4DB")) html += "<div class='description'><a href='https://bf4db.com/player/" + personaId + "' target='_blank'>BF4DB</a></div>"
                                                            + "<div class='description'>•</div>";								

					if (instance.storage("use.BF4CR")) html += "<div class='description'><a href='http://bf4cheatreport.com/?pid=" + personaId + "' target='_blank'>BF4CheatReport</a></div>"
															+ "<div class='description'>•</div>";
								
					if (instance.storage("use.247FairPlay")) html += "<div class='description'><a href='https://www.247fairplay.com/CheatDetector/" + soldierName + "' target='_blank'>247FairPlay</a></div>"
                                                                  + "<div class='description'>•</div>";
    
                    html += "<div class='clear'></div></div>";
                    
                    $("#overview-info div[class=box]").append(html);
                }
            }
        }
        else
        {
            $( "#advanced-player-links" ).remove();
        }
    }
});
