/*
 * Copyright (C) 2016-2021 phantombot.github.io/PhantomBot
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * multiCounter.js
 *
 * A counter system that can update a browser panel.
 */

// TODO: register counter names as aliases
// TODO: track all-time records (longest win/loss streak)
// TODO: game-specific counters
// TODO: !editctr
// TODO: !permctr

(function () {

    var VALUES_TABLE = 'multiCounterValues',
        TITLES_TABLE = 'multiCounterTitles',
        LINKS_TABLE = 'multiCounterLinks',
        SESSION_START_TABLE = 'multiCounterSessionStart',
        OPTIONS_TABLE = 'multiCounterOptions',
        COUNTERS_DIR = './addons/multicounter';

    var reValidCounterName = /^[a-z][a-z0-9]*$/;

    /**
     * @typedef Options
     * @type {Object}
     * @property {boolean} [hidden] Don't show the counter in the overlay or external files.
     * @property {boolean} [muted] Don't mention counter updates in the stream chat.
     * @property {boolean} [unlisted] Don't show the counter in !listctr.
     */

    var AVAILABLE_OPTIONS = ['hidden', 'muted', 'unlisted'];

    /**
     * @typedef Counter
     * @type {Object}
     * @property {string} title
     * @property {Object} [link]
     * @property {'ratio'|'streak'|'min'|'max'|'sum'} link.type
     * @property {string[]} link.others
     * @property {Options} options
     */

    /**
     * @type {Object<string, Counter>}
     */
    var counters = {};

    /**
     * Maps input counters (keys) to the linked counters that need to be updated when they change (values).
     * @type {Object<string, string[]>}
     */
    var dependencies = {};

    /**
     * @function rescanDependencies
     */
    function rescanDependencies() {
        dependencies = {};

        var keys = $.inidb.GetKeyList(LINKS_TABLE, '');
        for (var i in keys) {
            var ctr = cacheConfig(keys[i]);
            if (ctr.link && ctr.link.others) {
                for (var j in ctr.link.others) {
                    var o = ctr.link.others[j];
                    dependencies[o] = dependencies[o] || [];
                    dependencies[o].push(keys[i]);
                }
            }
        }
    }

    /**
     * @function updateDependentCounters
     * @param {string} name The counter that was explicitly modified to set off the chain of dependencies.
     * @param {number} oldValue The value of the counter before it was modified.
     * @returns {string[]} The names of the counters affected by the change (excluding any muted ones).
     */
    function updateDependentCounters(name, oldValue) {
        name = name.toLowerCase();
        var result = [name];
        var deps = dependencies[name];

        if (!deps) {
            return result;
        }

        deps = recurseDependencies(deps);

        /** @type {Object<string, string|number>} */
        var oldValues = {};
        /** @type {Object<string, string|number>} */
        var newValues = {};
        oldValues[name] = oldValue;
        newValues[name] = getCounterValue(name);

        while (deps.length > 0) {
            var linkName = deps.shift();

            if (newValues.hasOwnProperty(linkName)) {
                // already seen it
                continue;
            }

            var ctr = cacheConfig(linkName);
            if (!ctr.link) {
                $.log.warn('Ignoring non-link dependency "' + linkName + '" while updating deps from "' + name + '"');
                continue;
            }

            /** @type {LinkHandlerInput[]} */
            var inputs = [];

            for (var i in ctr.link.others) {
                var inputName = ctr.link.others[i];
                if (!oldValues.hasOwnProperty(inputName)) {
                    oldValues[inputName] = newValues[inputName] = getCounterValue(inputName);
                }
                inputs.push({ name: inputName, oldValue: oldValues[inputName], newValue: newValues[inputName] });
            }

            var previous = getLastLinkValue(linkName);
            oldValues[linkName] = previous;

            var handler = linkHandlers[ctr.link.type];
            var linkValue = handler(inputs, previous, ctr);
            newValues[linkName] = linkValue;
            setLastLinkValue(linkName, linkValue);

            if (!ctr.options.muted) {
                result.push(linkName);
            }
        }

        return result;
    }

    /**
     * @function recurseDependencies
     * @param {string[]} names 
     * @returns {string[]}
     */
    function recurseDependencies(names) {
        var result = [];
        var seen = {};
        insertAll(names);
        return result.reverse();

        function insertAll(items) {
            if (!items) {
                return;
            }
            for (var i in items) {
                if (seen[items[i]]) {
                    continue;
                }
                seen[items[i]] = true;
                result.push(items[i]);
                insertAll(dependencies[items[i]]);
            }
        }
    }

    /**
     * @function calculateInitialLinkValue
     * @param {Counter} ctr
     * @returns {string|number}
     */
    function calculateInitialLinkValue(ctr) {
        /** @type {LinkHandlerInput[]} */
        var inputs = [];

        for (var i in ctr.link.others) {
            var inputName = ctr.link.others[i];
            var value = getCounterValue(inputName);
            inputs.push({ name: inputName, oldValue: value, newValue: value });
        }

        var previous = null;

        var handler = linkHandlers[ctr.link.type];
        return handler(inputs, previous, ctr);
    }

    /**
     * @function updateExternalCounterViews
     * @param {String} name 
     */
    function updateExternalCounterViews(name) {
        var ctr = cacheConfig(name);

        if (!ctr || ctr.options.hidden) {
            return;
        }

        var value = ctr.link ? getLastLinkValue(name) : getCounterValue(name);

        updateCounterFile(name, ctr, value);
        updateMasterFile();
        updateSessionFile();
        updateWebSocket(name, ctr, value);
    }

    /**
     * @function updateCounterFile
     *
     * @param {String} name
     * @param {Counter} ctr
     * @param {number|string} value
     */
    function updateCounterFile(name, ctr, value) {
        var counterLongFile = COUNTERS_DIR + '/' + name + '.txt',
            counterShortFile = COUNTERS_DIR + '/' + name + '.raw.txt';

        if (!$.isDirectory(COUNTERS_DIR + '/')) {
            $.mkDir(COUNTERS_DIR);
        }

        var line = $.lang.get('multicounter.format.file', ctr.title, value + '');
        $.writeToFile(line, counterLongFile, false);

        $.writeToFile(value + '', counterShortFile, false);
    }

    function updateMasterFile() {
        var masterTxtFile = COUNTERS_DIR + '/ALL.txt',
            masterJsonFile = COUNTERS_DIR + '/ALL.json';
        
        var keys = $.inidb.GetKeyList(TITLES_TABLE, ''),
            obj = {},
            lines = [];
        
        for (var i in keys) {
            var ctr = cacheConfig(keys[i]);
            if (ctr.options.hidden) {
                continue;
            }
            var value = ctr.link ? getLastLinkValue(keys[i]) : getCounterValue(keys[i]).toFixed(0),
                title = $.getIniDbString(TITLES_TABLE, keys[i], keys[i]);
            obj[keys[i]] = { title: title, value: value };
            lines.push($.lang.get('multicounter.format.file', title, value));
        }

        $.writeToFile(lines.join('\n'), masterTxtFile, false);
        $.writeToFile(JSON.stringify(obj), masterJsonFile, false);
    }

    function updateSessionFile() {
        var sessionTxtFile = COUNTERS_DIR + '/SESSION.txt',
            sessionJsonFile = COUNTERS_DIR + '/SESSION.json';
        
        var keys = $.inidb.GetKeyList(TITLES_TABLE, ''),
            obj = {},
            lines = [];
        
        for (var i in keys) {
            var ctr = cacheConfig(keys[i]);
            if (ctr.options.hidden) {
                continue;
            }
            var newValue = ctr.link ? getLastLinkValue(keys[i]) : getCounterValue(keys[i]).toFixed(0),
                title = $.getIniDbString(TITLES_TABLE, keys[i], keys[i]),
                oldValue = $.getIniDbString(SESSION_START_TABLE, keys[i]);
            if (oldValue !== undefined && oldValue !== newValue) {
                obj[keys[i]] = { title: title, oldValue: oldValue, newValue: newValue };
                lines.push($.lang.get('multicounter.format.session.file', title, oldValue, newValue));
            }
        }

        $.writeToFile(lines.join('\n'), sessionTxtFile, false);
        $.writeToFile(JSON.stringify(obj), sessionJsonFile, false);
    }

    function updateWebSocket(name, ctr, value) {
        $.panelsocketserver.sendJSONToAll(JSON.stringify(
            {
                'counter_update': true,
                'data': JSON.stringify([
                    { 'name': String(name), 'title': String(ctr.title), 'value': value }
                ])
            }
        ));
    }

    function sayCounterValue(sender, name) {
        var ctr = cacheConfig(name);
        var value = ctr.link ? getLastLinkValue(name) : getCounterValue(name).toFixed(0);
        $.say($.lang.get('multicounter.format.chat', ctr.title, value, $.whisperPrefix(sender), name));
    }

    function sayUpdatedCounterValues(sender, names) {
        for (var i in names) {
            sayCounterValue(sender, names[i]);
        }
    }

    /**
     * @function setCounterValue
     * @param {string} name 
     * @param {number} value 
     */
    function setCounterValue(name, value) {
        var oldValue = getCounterValue(name);
        $.setIniDbNumber(VALUES_TABLE, name.toLowerCase(), value);
        updateExternalCounterViews(name);
        return updateDependentCounters(name, oldValue);
    }

    /**
     * @function getCounterValue
     * @param {string} name 
     * @returns {number}
     */
    function getCounterValue(name) {
        return $.getIniDbNumber(VALUES_TABLE, name.toLowerCase(), 0);
    }

    /**
     * @function setLastLinkValue
     * @param {string} name 
     * @param {number} value 
     */
    function setLastLinkValue(name, value) {
        $.setIniDbString(VALUES_TABLE, name.toLowerCase(), value);
        updateExternalCounterViews(name);
    }
    
    /**
     * @function getLastLinkValue
     * @param {string} name
     * @returns {string}
     */
    function getLastLinkValue(name) {
        return $.getIniDbString(VALUES_TABLE, name.toLowerCase(), '');
    }

    /**
     * @function incrementCounterValue
     * @param {string} name 
     * @param {number} amount 
     */
    function incrementCounterValue(name, amount) {
        var oldValue = getCounterValue(name);
        $.inidb.incr(VALUES_TABLE, name.toLowerCase(), amount);
        updateExternalCounterViews(name);
        return updateDependentCounters(name, oldValue);
    }

    /**
     * @function cacheConfig
     * @param {string} name 
     * @returns {Counter|null}
     */
    function cacheConfig(name) {
        name = name.toLowerCase();
        return counters[name] || (counters[name] = loadCounterConfig(name));
    }

    /**
     * @function loadCounterConfig
     * @param {string} name 
     * @returns {Counter|null}
     */
    function loadCounterConfig(name) {
        var title = $.getIniDbString(TITLES_TABLE, name, null);
        if (title === null) {
            return null;
        }

        /** @type {Counter} */
        var result = { title: String(title) };

        var link = $.getIniDbString(LINKS_TABLE, name, null);
        if (link) {
            var parts = link.split(';');
            result.link = { type: parts[0], others: parts.slice(1).join(';').split(',') };
        }

        result.options = {};
        var options = $.getIniDbString(OPTIONS_TABLE, name, null);
        if (options) {
            try {
                result.options = JSON.parse(options);
            } catch (e) {
                $.log.warn('Discarding counter options due to parse error: ' + name);
            }
        }

        return result;
    }

    /**
     * @function counterExists
     * @param {string} name 
     * @returns {boolean}
     */
    function counterExists(name) {
        return !!cacheConfig(name);
    }

    /**
     * @typedef LinkHandlerInput
     * @type {Object}
     * @prop {string} name
     * @prop {number|string} newValue
     * @prop {number|string} oldValue
     */

    /**
     * @callback LinkHandler
     * @param {LinkHandlerInput[]} inputs
     * @param {number|string|null} previous
     * @param {Counter} ctr
     * @returns {number|string}
     */

    /**
     * @type {Object<string, LinkHandler>}
     */
    var linkHandlers = {
        ratio: ratioLink,
        streak: streakLink,
        sum: sumLink,
        min: minLink,
        max: maxLink,
    };

    /**
     * @function formatPercentage
     * @param {number} pct 
     * @returns {string}
     */
    function formatPercentage(pct) {
        return (pct * 100.0).toFixed(1) + '%';
    }

    /**
     * Returns a percentage describing the ratio between the first input and the sum of all inputs.
     * 
     * Example:
     * ```plain
     *     !linkctr mskratio ratio mskwin,mskloss MSK Win Ratio
     *     # MSK Win Ratio: 35.9%
     * ```
     * 
     * @type LinkHandler
     */
    function ratioLink(inputs) {
        var total = 0.0;
        for (var i in inputs) {
            total += inputs[i].newValue;
        }
        return formatPercentage(inputs[0].newValue / total);
    }

    /**
     * Returns the sum of all inputs.
     * 
     * Example:
     * ```plain
     *     !linkctr mskattempt sum mskwin,mskloss MSK Attempts
     *     # MSK Attempts: 502
     * ```
     * @type LinkHandler
     */
    function sumLink(inputs) {
        var total = 0.0;
        for (var i in inputs) {
            total += inputs[i].newValue;
        }
        return total;
    }

    /**
     * Returns a string describing the input(s) with the lowest value.
     * 
     * Example:
     * ```plain
     *     !linkctr leastchosen min liukang,raiden,subzero,scorpion Least Chosen Character
     *     # Least Chosen Character: Raiden/Liu Kang (6)
     * ```
     * @type LinkHandler
     */
    function minLink(inputs) {
        var result = null;
        var resultTitles = [];
        for (var i in inputs) {
            var nv = inputs[i].newValue;
            if (typeof nv === 'number') {
                if (result === null || nv < result) {
                    result = nv;
                    resultTitles = [cacheConfig(inputs[i].name).title];
                } else if (nv === result) {
                    resultTitles.push(cacheConfig(inputs[i].name).title);
                }
            }
        }
        return resultTitles.join('/') + ' (' + result + ')';
    }

    /**
     * Returns a string describing the input(s) with the highest value.
     * 
     * Example:
     * ```plain
     *     !linkctr mostchosen max liukang,raiden,subzero,scorpion Most Chosen Character
     *     # Most Chosen Character: Sub Zero/Scorpion (9)
     * ```
     * @type LinkHandler
     */
    function maxLink(inputs) {
        var result = null;
        var resultTitles = [];
        for (var i in inputs) {
            var nv = inputs[i].newValue;
            if (typeof nv === 'number') {
                if (result === null || nv > result) {
                    result = nv;
                    resultTitles = [cacheConfig(inputs[i].name).title];
                } else if (nv === result) {
                    resultTitles.push(cacheConfig(inputs[i].name).title);
                }
            }
        }
        return resultTitles.join('/') + ' (' + result + ')';
    }

    /**
     * Returns a string counting repeated increases in the same input.
     * If more than one input is changed at a time, the result is undefined.
     * 
     * Example:
     * ```plain
     *     !linkctr mskstreak streak mskwin,mskloss MSK Streak
     *     # MSK Streak: 3 MSK Wins
     * ```
     * 
     * @type LinkHandler
     */
    function streakLink(inputs, previous) {
        var changed = null;
        var delta = null;

        for (var i in inputs) {
            if (inputs[i].newValue !== inputs[i].oldValue) {
                delta = inputs[i].newValue - inputs[i].oldValue;
                changed = inputs[i].name;
                break;
            }
        }

        if (delta === null || delta === 0) {
            return previous;
        }

        if (delta < 0) {
            // decreased? can't track the streak without historical data
            return '';
        }

        // add delta onto the existing streak
        var changedTitle = cacheConfig(changed).title;

        var prevCount, prevTitle;
        if (!previous || previous === '') {
            prevCount = 0;
            prevTitle = changedTitle;
        } else {
            var parts = (previous + '').split(' ');
            prevCount = parseInt(parts[0]);
            prevTitle = parts.slice(1).join(' ');
        }

        if (prevTitle === changedTitle) {
            return (prevCount + 1) + ' ' + prevTitle;
        }

        return '1 ' + changedTitle;
    }

    /*
     * @event command
     */
    $.bind('command', function (event) {
        var sender = event.getSender(),
            command = event.getCommand(),
            args = event.getArgs(),
            name = args[0] && args[0].replace('!', '').toLowerCase(),
            action = args[1],
            subaction = args[2];

        /*
         * @commandpath addctr [name] [title] - Add a new counter.
         */
        if (command.equalsIgnoreCase('addctr')) {
            var title = args.slice(1).join(' ');

            if (!name || !title) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.usage'));
                return;
            }

            if (counterExists(name)) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.error.exists'));
                return;
            }

            if (!reValidCounterName.test(name)) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.error.badname'));
                return;
            }

            counters[name] = { title: title, options: {} };
            
            $.inidb.set(VALUES_TABLE, name, 0);
            $.inidb.set(TITLES_TABLE, name, title);
            $.inidb.set(OPTIONS_TABLE, name, '{}');

            $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.success', name, title)); 
            return;
        }

        /*
         * @commandpath delctr [name] - Delete a counter.
         */
        if (command.equalsIgnoreCase('delctr')) {
            if (!name) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.delctr.usage'));
                return;
            }

            if (!counterExists(name)) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.404'));
                return;
            }

            delete counters[name];

            $.inidb.del(VALUES_TABLE, name);
            $.inidb.del(TITLES_TABLE, name);
            $.inidb.del(LINKS_TABLE, name);
            $.inidb.del(OPTIONS_TABLE, name);

            $.panelsocketserver.sendJSONToAll(JSON.stringify(
                {
                    'counter_update': true,
                    'data': JSON.stringify([
                        { '$delete': String(name) }
                    ])
                }
            ));

            $.say($.whisperPrefix(sender) + $.lang.get('multicounter.delctr.success', name));
            return;
        }

        /*
         * @commandpath listctr [-all] - List all counters.
         */
        if (command.equalsIgnoreCase('listctr') || command.equalsIgnoreCase('listctrs')) {
            /** @type {string[]} */
            var keys = $.inidb.GetKeyList(TITLES_TABLE, '');
            var includeUnlisted = args[0] && args[0].equalsIgnoreCase('-all') && $.isMod(sender);
            if (!includeUnlisted) {
                keys = keys.filter(function (k) {
                    var ctr = cacheConfig(k);
                    return !ctr.options.unlisted;
                });
            }
            keys = keys.map(function (k) {
                var ctr = cacheConfig(k);
                var opts = '';
                if (ctr.options.hidden) {
                    opts += 'h';
                }
                if (ctr.options.muted) {
                    opts += 'm';
                }
                if (ctr.options.unlisted) {
                    opts += 'u';
                }
                return opts ? k + ' (' + opts + ')' : k;
            });
            if (keys.length) {
                $.paginateArray(keys, 'multicounter.listctr.counters', ', ', true, sender);
            } else {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.listctr.nocounters'));
            }
            return;
        }

        /*
         * @commandpath linkctr [name] [type (ratio/streak/sum/min/max)] [other1,other2...] [title] - Add a counter whose value is derived from others.
         */
        if (command.equalsIgnoreCase('linkctr')) {
            var type = args[1];
            var others = args[2];
            var title = args.slice(3).join(' ');

            if (name && !type && !others && !title) {
                // show existing link definition
                var ctr = cacheConfig(name);
                if (!ctr) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.404'));
                } else if (!ctr.link) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.error.exists'));
                } else {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.linkctr.existing', name, ctr.link.type, ctr.link.others.join()));
                }
                return;
            }

            if (!name || !type || !others || !title) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.linkctr.usage'));
                return;
            }

            if (counterExists(name)) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.error.exists'));
                return;
            }

            if (!reValidCounterName.test(name)) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.addctr.error.badname'));
                return;
            }

            var ctr = {
                title: title,
                link: { type: type, others: others.split(',') },
                options: {}
            };

            for (var i in ctr.link.others) {
                if (!counterExists(ctr.link.others[i])) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.linkctr.error.404', ctr.link.others[i]));
                    return;
                }
            }

            counters[name] = ctr;

            $.inidb.set(TITLES_TABLE, name, title);
            $.inidb.set(LINKS_TABLE, name, type + ';' + others);

            rescanDependencies();
            var value = calculateInitialLinkValue(counters[name]);
            setLastLinkValue(name, value);

            $.say($.lang.get('multicounter.format.chat', title, value, $.whisperPrefix(sender), name));
            return;
        }

        /*
         * @commandpath optctr [name] [+option -option ...] - Display or change a counter's options.
         */
        if (command.equalsIgnoreCase('optctr')) {
            if (!name) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.optctr.usage'));
                return;
            }

            var ctr = cacheConfig(name);
            if (!ctr) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.404'));
                return;
            }

            var wasHidden = !!ctr.options.hidden;

            /**
             * @type {Array<{key: string, value: boolean}>}
             */
            var changes = [];

            for (var i = 1; i < args.length; i++) {
                var opt = args[i] + '';
                var optPrefix = opt.substring(0, 1);
                var optName = opt.substring(1);
                if ((optPrefix !== '+' && optPrefix !== '-') || AVAILABLE_OPTIONS.indexOf(optName) < 0) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.optctr.usage'));
                    return;
                }
                changes.push({key: optName, value: optPrefix === '+'});
            }

            // update in-memory config
            for (var i in changes) {
                ctr.options[changes[i].key] = changes[i].value;
            }

            // update persistent config
            $.setIniDbString(OPTIONS_TABLE, name, JSON.stringify(ctr.options));

            // add/remove from overlay
            var isHidden = !!ctr.options.hidden;
            if (isHidden && !wasHidden) {
                $.panelsocketserver.sendJSONToAll(JSON.stringify(
                    {
                        'counter_update': true,
                        'data': JSON.stringify([
                            { '$delete': String(name) }
                        ])
                    }
                ));
            } else if (wasHidden && !isHidden) {
                var value = ctr.link ? getLastLinkValue(name) : getCounterValue(name);
                updateWebSocket(name, ctr, value);
            }

            // report
            var summary = AVAILABLE_OPTIONS.map(function (k) {
                return (ctr.options[k] ? '+' : '-') + k;
            }).join(' ');

            $.say($.whisperPrefix(sender) + $.lang.get('multicounter.optctr.success', name, summary));
            return;
        }

        /*
         * @commandpath ctr [name] - Display the current value of a counter.
         */
        if (command.equalsIgnoreCase('ctr')) {
            if (!name) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.ctr.usage'));
                return;
            }

            var ctr = cacheConfig(name);

            if (!ctr) {
                $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.404'));
                return;
            }

            if (action === undefined) {
                sayCounterValue(sender, name);
                return;
            }

            /*
             * @commandpath ctr [name] reset [newValue] - Reset a counter to the given number, or zero.
             */
            if (action.equalsIgnoreCase('reset')) {
                if (cacheConfig(name).link) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.link.change', name));
                    return;
                }
                var value = parseInt(subaction);
                if (isNaN(value)) {
                    value = 0;
                }
                var updatedNames = setCounterValue(name, value);
                sayUpdatedCounterValues(sender, updatedNames);
                return;
            }

            /*
             * @commandpath ctr [name] incr [amount] - Add one or another amount to the named counter.
             */
            if (action.equalsIgnoreCase('add') || action.equalsIgnoreCase('incr') || action.equalsIgnoreCase('+')) {
                if (cacheConfig(name).link) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.link.change', name));
                    return;
                }
                var value = parseInt(subaction);
                if (isNaN(value) || value < 1) {
                    value = 1;
                }
                var updatedNames = incrementCounterValue(name, value);
                sayUpdatedCounterValues(sender, updatedNames);
                return;
            }

            /*
             * @commandpath ctr [name] decr [amount] - Subtract one or another amount from the named counter.
             */
            if (action.equalsIgnoreCase('sub') || action.equalsIgnoreCase('decr') || action.equalsIgnoreCase('-')) {
                if (cacheConfig(name).link) {
                    $.say($.whisperPrefix(sender) + $.lang.get('multicounter.error.link.change', name));
                    return;
                }
                var value = parseInt(subaction);
                if (isNaN(value) || value < 1) {
                    value = 1;
                }
                var updatedNames = incrementCounterValue(name, -value);
                sayUpdatedCounterValues(sender, updatedNames);
                return;
            }
        }
    });

    /** @type {Function} */
    var origGetSubCommandFromArguments;

    /**
     * @function getSubCommandFromArguments
     *
     * @param {String}   command
     * @param {String[]} args
     */
    function getSubCommandFromArguments(command, args) {
        if ($.bot.isModuleEnabled('./custom/multiCounter.js') && command.equalsIgnoreCase('ctr') && args[1] !== undefined) {
            var subCommand = args[1].toLowerCase();

            if ($.subCommandExists(command, subCommand)) {
                return subCommand;
            }
        }

        return origGetSubCommandFromArguments(command, args);
    }

    getSubCommandFromArguments.isMultiCounterHook = true;

    /**
     * @function resetSession
     */
    function resetSession() {
        $.inidb.RemoveFile(SESSION_START_TABLE);
        var keys = $.inidb.GetKeyList(VALUES_TABLE, '');
        for (var i in keys) {
            var name = keys[i];
            var ctr = cacheConfig(name);
            var value = ctr.link ? getLastLinkValue(name) : getCounterValue(name).toFixed(0);
            $.setIniDbString(SESSION_START_TABLE, name, value);
        }
    }

    /**
     * @event twitchOnline
     */
    $.bind('twitchOnline', function () {
        resetSession();
    });

    /**
     * @event initReady
     */
    $.bind('initReady', function () {
        // hook getSubCommandFromArguments
        if (!$.getSubCommandFromArguments.isMultiCounterHook) {
            origGetSubCommandFromArguments = $.getSubCommandFromArguments;
            $.getSubCommandFromArguments = getSubCommandFromArguments;
        }

        $.registerChatCommand('./custom/multiCounter.js', 'addctr', 1);
        $.registerChatCommand('./custom/multiCounter.js', 'ctr', 7);
        $.registerChatCommand('./custom/multiCounter.js', 'delctr', 1);
        $.registerChatCommand('./custom/multiCounter.js', 'listctr', 7);
        $.registerChatCommand('./custom/multiCounter.js', 'listctrs', 7);
        $.registerChatCommand('./custom/multiCounter.js', 'linkctr', 1);
        $.registerChatCommand('./custom/multiCounter.js', 'optctr', 1);

        $.registerChatSubcommand('ctr', 'reset', 2);
        $.registerChatSubcommand('ctr', 'add', 2);
        $.registerChatSubcommand('ctr', 'incr', 2);
        $.registerChatSubcommand('ctr', '+', 2);
        $.registerChatSubcommand('ctr', 'sub', 2);
        $.registerChatSubcommand('ctr', 'decr', 2);
        $.registerChatSubcommand('ctr', '-', 2);

        if (!$.isOnline($.channelName)) {
            resetSession();
        }
    });

    /*
    * Export functions to API
    */
    $.multiCounter = {
        getValue: getCounterValue,
        setValue: setCounterValue,
        incrementValue: incrementCounterValue
    };

    rescanDependencies();
}) ();
