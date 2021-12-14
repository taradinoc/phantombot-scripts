/*
 * Copyright (C) 2016-2019 phantombot.tv
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

(function() {
    var cost = 0,
        entries = [],
        winners = [],
        winnersCalledAt = {},
        absentees = [],
        subTMulti = 1,
        regTMulti = 1,
        maxEntries = 0,
        followers = false,
        raffleStatus = false,
        msgToggle = $.getSetIniDbBoolean('settings', 'tRaffleMSGToggle', false),
        raffleMessage = $.getSetIniDbString('settings', 'traffleMessage', 'A raffle is still opened! Type !tickets (amount) to enter. (entries) users have entered so far.'),
        messageInterval = $.getSetIniDbNumber('settings', 'traffleMessageInterval', 0),
        totalEntries = 0,
        lastTotalEntries = 0,
        totalTickets = 0,
        a = '',
        interval,
        useFiles = $.getSetIniDbBoolean('settings', 'traffleUseFiles', true),
        sessionWinCountToggle = $.getSetIniDbBoolean('settings', 'traffleSessionWinCount', true),
        sessionWinCountInterval = $.getSetIniDbNumber('settings', 'traffleSessionWinCountInterval', 4 * 3600);

    function reloadTRaffle() {
        msgToggle = $.getIniDbBoolean('settings', 'tRaffleMSGToggle');
        raffleMessage = $.getSetIniDbString('settings', 'traffleMessage');
        messageInterval = $.getSetIniDbNumber('settings', 'traffleMessageInterval');
        useFiles = $.getSetIniDbBoolean('settings', 'traffleUseFiles');
        sessionWinCountToggle = $.getSetIniDbBoolean('settings', 'traffleSessionWinCount');
    }

    function checkArgs(user, max, regMulti, subMulti, price, followersOnly) {
        if (raffleStatus) {
            $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.err.raffle.opened'));
            return;
        }

        if (!max) {
            $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.err.missing.syntax'));
            return;
        }

        if (isNaN(parseInt(max)) || isNaN(parseInt(price))) {
            $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.usage'));
            return;
        }

        if (max) {
            maxEntries = parseInt(max);
        }

        if (price) {
            cost = parseInt(price);
        }

        if (regMulti) {
            regTMulti = (parseFloat(regMulti) < 1 ? 1 : parseFloat(regMulti));
        }

        if (subMulti) {
            subTMulti = (parseFloat(subMulti) < 1 ? 1 : parseFloat(subMulti));
        }

        if (followersOnly && followersOnly.equalsIgnoreCase('-followers')) {
            followers = true;
            a = $.lang.get('ticketrafflesystem.msg.need.to.be.follwing');
        }
        openRaffle(maxEntries, followers, cost, a, user);
        $.inidb.set('traffleSettings', 'isActive', 'true');
        $.inidb.set('traffleSettings', 'maxEntries', maxEntries);
        $.inidb.set('traffleSettings', 'cost', cost);
        $.inidb.set('traffleSettings', 'followers', followers);
        $.inidb.set('traffleSettings', 'regTMulti', regTMulti);
        $.inidb.set('traffleSettings', 'subTMulti', subTMulti);
    };

    function openRaffle(maxEntries, followers, cost, a, user) {
        $.say($.lang.get('ticketrafflesystem.raffle.opened', maxEntries, $.getPointsString(cost), a));
        raffleStatus = true;
        $.inidb.RemoveFile('ticketsList');
        $.inidb.RemoveFile('ticketCostList');
        $.inidb.RemoveFile('ticketBonusType');
        $.inidb.RemoveFile('ticketWinnersList');
        $.inidb.RemoveFile('ticketAbsenteeList');
        $.inidb.RemoveFile('entered');
        $.inidb.set('raffleresults', 'ticketRaffleEntries', 0);
        $.inidb.del('traffleresults', 'winner');
        // entries = "";
        entries = [];
        winners = [];
        winnersCalledAt = {};
        absentees = [];

        startMessageInterval();

        $.log.event(user + ' opened a ticket raffle.');
    };

    function startMessageInterval() {
        if (messageInterval != 0) {
            interval = setInterval(function() {
                $.say(raffleMessage.replace('(entries)', String(totalEntries))); //can't use regex here. why? who knows.
            }, messageInterval * 6e4);
        }
    }

    function closeRaffle(user) {
        if (!raffleStatus) {
            $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.err.raffle.not.opened'));
            return;
        }

        clear();

        $.say($.lang.get('ticketrafflesystem.raffle.closed'));
        $.log.event(user + ' closed a ticket raffle.');
    };

    function clear() {
        clearInterval(interval);

        raffleStatus = false;
        followers = false;
        maxEntries = 0;
        cost = 0;
        a = '';
        totalEntries = 0;
        lastTotalEntries = 0;
        totalTickets = 0;
        regTMulti = 1;
        subTMulti = 1;
        $.inidb.set('traffleSettings', 'isActive', 'false');
    };

    function winner(force) {
        if (entries.length == 0) {
            if (winners.length == 0) {
                $.say($.lang.get('ticketrafflesystem.raffle.close.err'));
            } else {
                $.say($.lang.get('ticketrafflesystem.raffle.close.nomore'));
            }
            return;
        }

        var Winner = $.randElement(entries),
            isFollowing = ($.isBot(Winner.toLowerCase()) || $.isOwner(Winner.toLowerCase()) || $.user.isFollower(Winner.toLowerCase())),
            followMsg = (isFollowing ? $.lang.get('rafflesystem.isfollowing') : $.lang.get('rafflesystem.isnotfollowing')),
            epicname = ($.bot.isModuleEnabled('./custom/epicLink.js') ? $.epicLink.getEpicName(Winner) : null),
            epicMsg = (epicname ? $.lang.get('ticketrafflesystem.winner.epic', epicname) : $.lang.get('ticketrafflesystem.winner.noepic'));

        $.say($.lang.get('ticketrafflesystem.winner', $.username.resolve(Winner), followMsg, epicMsg));
        $.log.event('Winner of the ticket raffle was ' + Winner);

        // remove the winner's entries
        for (var i = entries.length - 1; i >= 0; i--) {
            if (entries[i].equalsIgnoreCase(Winner)) {
                entries.splice(i, 1);
            }
        }
        winners.push(Winner);
        winnersCalledAt[Winner] = Date.now();
        $.inidb.set('ticketWinnersList', Winner, $.inidb.get('ticketsList', Winner));
        $.inidb.del('ticketsList', Winner);
        $.inidb.decr('raffleresults', 'ticketRaffleEntries', 1);

        var prev = $.getIniDbString('traffleresults', 'winner', '');
        if (prev.length) {
            prev += ';';
        }
        $.inidb.set('traffleresults', 'winner', prev + $.username.resolve(Winner) + ' ' + followMsg);

        $.inidb.incr('traffleSessionWinners', Winner, 1);
        var wins = $.getIniDbNumber('traffleSessionWinners', Winner, 1);
        $.log.event('Session win count: ' + wins.toFixed(0));
        if (sessionWinCountToggle) {
            if ($.lang.exists('ticketrafflesystem.sessionwins.' + wins.toFixed(0))) {
                $.say($.lang.get('ticketrafflesystem.sessionwins.' + wins.toFixed(0), $.username.resolve(Winner), wins.toFixed(0)));
            } else {
                $.say($.lang.get('ticketrafflesystem.sessionwins', $.username.resolve(Winner), wins.toFixed(0)));
            }
        }
    };

    function unwinner(username) {
        username = username.toLowerCase();
        var winningTickets = $.getIniDbNumber('ticketWinnersList', username, -1);
        if (winningTickets === -1) {
            $.say($.lang.get('ticketrafflesystem.unwinner.err', $.username.resolve(username)));
            return;
        }

        $.say($.lang.get('ticketrafflesystem.unwinner', $.username.resolve(username), winningTickets));
        $.log.event('Returning ' + username + ' to ticket raffle pool with ' + winningTickets + ' tickets');

        for (var i = 0; i < winningTickets; i++) {
            entries.push(username);
        }
        for (var i = winners.length - 1; i >= 0; i--) {
            if (winners[i].equalsIgnoreCase(username)) {
                delete winnersCalledAt[winners[i]];
                winners.splice(i, 1);
            }
        }
        $.inidb.set('ticketsList', username, winningTickets);
        $.inidb.del('ticketWinnersList', username);
        $.inidb.incr('raffleresults', 'ticketRaffleEntries', 1);
        $.inidb.decr('traffleSessionWinners', username, 1);
    }

    function absent(username) {
        username = username.toLowerCase();
        var winningTickets = $.getIniDbNumber('ticketWinnersList', username, -1);
        if (winningTickets === -1) {
            $.say($.lang.get('ticketrafflesystem.absent.err', $.username.resolve(username)));
            return;
        }

        $.say($.lang.get('ticketrafflesystem.absent', $.username.resolve(username), winningTickets));
        $.log.event('Marking ' + username + ' absent with ' + winningTickets + ' tickets');

        // don't restore ticket entries

        absentees.push(username);
        var now = Date.now(), calledAt = now;

        for (var i = winners.length - 1; i >= 0; i--) {
            if (winners[i].equalsIgnoreCase(username)) {
                if (winnersCalledAt[winners[i]]) {
                    calledAt = winnersCalledAt[winners[i]];
                    delete winnersCalledAt[winners[i]];
                }
                winners.splice(i, 1);
            }
        }
        var waitedSeconds = Math.round((now - calledAt) / 1000);
        $.inidb.set('ticketAbsenteeList',
            username,
            JSON.stringify({ winningTickets: winningTickets, waitedSeconds: waitedSeconds, type: 'absent' }));
        $.inidb.del('ticketWinnersList', username);
        $.inidb.decr('traffleSessionWinners', username, 1);
    }

    function pass(username) {
        username = username.toLowerCase();
        var winningTickets = $.getIniDbNumber('ticketWinnersList', username, -1);
        if (winningTickets === -1) {
            $.say($.lang.get('ticketrafflesystem.pass.err', $.username.resolve(username)));
            return;
        }

        $.say($.lang.get('ticketrafflesystem.pass', $.username.resolve(username), winningTickets));
        $.log.event('Marking ' + username + ' passed with ' + winningTickets + ' tickets');

        // don't restore ticket entries

        absentees.push(username);
        var now = Date.now(), calledAt = now;

        for (var i = winners.length - 1; i >= 0; i--) {
            if (winners[i].equalsIgnoreCase(username)) {
                if (winnersCalledAt[winners[i]]) {
                    calledAt = winnersCalledAt[winners[i]];
                    delete winnersCalledAt[winners[i]];
                }
                winners.splice(i, 1);
            }
        }
        var waitedSeconds = Math.round((now - calledAt) / 1000);
        $.inidb.set('ticketAbsenteeList',
            username,
            JSON.stringify({ winningTickets: winningTickets, waitedSeconds: waitedSeconds, type: 'pass' }));
        $.inidb.del('ticketWinnersList', username);
        $.inidb.decr('traffleSessionWinners', username, 1);
    }

    /**
     * @function calculateBonus
     * @param {$.CommandEvent} event 
     * @returns {{multiplier: number, maxPoints: number, maxEntries: number, bonusType: "none"|"regular"|"subscriber"}}
     */
    function calculateBonus(event) {
        var multiplier, bonusType;
        var args = event.getArgs();

        if (args[0] && args[0].equalsIgnoreCase('forceenter')) {
            // can't use tags. sender is the moderator, args[1] is the user being entered.
            var puppet = $.user.sanitize(args[1]);
            if ($.isSub(puppet)) {
                multiplier = subTMulti;
                bonusType = 'subscriber';
            } else if ($.isReg(puppet)) {
                multiplier = regTMulti;
                bonusType = 'regular';
            } else {
                multiplier = 1;
                bonusType = 'none';
            }
        } else {
            if (event.getTags().containsKey('subscriber') && event.getTags().get('subscriber').equals('1')) {
                multiplier = subTMulti;
                bonusType = 'subscriber';
            } else if ($.isReg(event.getSender())) {
                multiplier = regTMulti;
                bonusType = 'regular';
            } else {
                multiplier = 1;
                bonusType = 'none';
            }
        }

        return {
            multiplier: multiplier,
            maxPoints: maxEntries * cost,
            maxEntries: Math.floor(maxEntries * multiplier),
            bonusType: bonusType
        };
    }

    function enterRaffle(user, event, times) {
        if (!raffleStatus) {
            if (msgToggle) {
                $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.err.raffle.not.opened'));
            }
            return;
        }

        var bonus = calculateBonus(event),
            newEntries = Math.floor(times * bonus.multiplier);

        if (times > bonus.maxPoints || times == 0 || times < 0) {
            if (msgToggle) {
                $.say($.whisperPrefix(user) + getTicketsUsageMessage(user, event));
            }
            return;
        }

        var prevEntries = 0;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].equalsIgnoreCase(user)) {
                prevEntries++;
                if ((prevEntries + newEntries) > bonus.maxEntries) {
                    if (msgToggle) {
                        $.say($.whisperPrefix(user) + getTicketsUsageMessage(user, event));
                    }
                    return;
                }
            }
        }

        if (cost > 0) {
            if ((times * cost) > $.getUserPoints(user)) {
                if (msgToggle) {
                    $.say($.whisperPrefix(user) + getTicketsUsageMessage(user, event));
                }
                return;
            }
        }

        if (!$.inidb.exists('entered', user.toLowerCase())) {
            totalEntries++;
        }
        totalTickets += newEntries;
        $.inidb.decr('points', user.toLowerCase(), (times * cost));
        incr(user.toLowerCase(), newEntries, times * cost, bonus.bonusType);

        for (var i = 0; i < newEntries; i++) {
            entries.push(user);
        }
        if (msgToggle) {
            if (prevEntries > 0) {
                $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.enter.reconfirm', newEntries, newEntries + prevEntries));
            } else {
                $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.enter.confirm', newEntries));
                if ($.bot.isModuleEnabled('./custom/epicLink.js') && !$.epicLink.getEpicName(user)) {
                    $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.enter.setepic'));
                }
            }
        }
    }

    function leaveRaffle(user) {
        if (!raffleStatus) {
            if (msgToggle) {
                $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.err.raffle.not.opened'));
            }
            return;
        }

        if (!$.inidb.exists('entered', user.toLowerCase())) {
            if (msgToggle) {
                $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.leave.err.not.entered'));
            }
            return;
        }

        totalEntries--;

        for (var i = entries.length - 1; i >= 0; i--) {
            if (entries[i].equalsIgnoreCase(user)) {
                entries.splice(i, 1);
                totalTickets--;
            }
        }

        $.inidb.del('entered', user.toLowerCase());
        $.inidb.decr('raffleresults', 'ticketRaffleEntries', 1);
        $.inidb.del('ticketsList', user.toLowerCase());

        var cost = getTicketCost(user);
        $.inidb.del('ticketCostList', user.toLowerCase());
        $.inidb.del('ticketBonusType', user.toLowerCase());
        $.inidb.incr('points', user.toLowerCase(), cost);

        if (msgToggle) {
            $.say($.whisperPrefix(user) + $.lang.get('ticketrafflesystem.leave', $.getPointsString(cost)));
        }
    }

    /**
     * @function incr
     * @param {string} user 
     * @param {number} times 
     * @param {number} cost
     * @param {"none"|"regular"|"subscriber"} bonusType
     */
    function incr(user, times, cost, bonusType) {
        if (!$.inidb.exists('entered', user.toLowerCase())) {
            $.inidb.set('entered', user.toLowerCase(), 'true');
            $.inidb.incr('raffleresults', 'ticketRaffleEntries', 1);
        }
        $.inidb.incr('ticketsList', user.toLowerCase(), times);
        $.inidb.incr('ticketCostList', user.toLowerCase(), cost);
        var oldBonusType = $.getIniDbString('ticketBonusType', user.toLowerCase(), 'none');
        var newBonusType = bonusType;
        if (oldBonusType === 'subscriber' ||
            (oldBonusType === 'regular' && bonusType !== 'subscriber')) {
            newBonusType = oldBonusType;
        }
        $.inidb.set('ticketBonusType', user.toLowerCase(), newBonusType);
    }

    /**
     * @function getTickets
     * @param {string} user 
     * @returns {number}
     */
    function getTickets(user) {
        if (!$.inidb.exists('ticketsList', user.toLowerCase())) {
            return 0;
        }
        return $.getIniDbNumber('ticketsList', user.toLowerCase());
    };

    /**
     * @function getTicketCost
     * @param {string} user
     * @returns {number}
     */
    function getTicketCost(user) {
        if (!$.inidb.exists('ticketCostList', user.toLowerCase())) {
            return 0;
        }
        return $.getIniDbNumber('ticketCostList', user.toLowerCase());
    }

    /**
     * @function getTicketBonusType
     * @param {string} user 
     * @returns {"none"|"regular"|"subscriber"}
     */
    function getTicketBonusType(user) {
        return $.getIniDbString('ticketBonusType', user.toLowerCase(), 'none');
    }

    /**
     * @function getAllTickets
     * @returns {Object<string, number>}
     */
    function getAllTickets() {
        var result = {},
            keys = $.inidb.GetKeyList('ticketsList', '');
        for (var i in keys) {
            result[keys[i]] = $.getIniDbNumber('ticketsList', keys[i]);
        }
        return result;
    }

    /**
     * @function getAllTicketCosts
     * @returns {Object<string, number>}
     */
    function getAllTicketCosts() {
        var result = {},
            keys = $.inidb.GetKeyList('ticketCostList', '');
        for (var i in keys) {
            result[keys[i]] = $.getIniDbNumber('ticketCostList', keys[i]);
        }
        return result;
    }

    /**
     * @event command
     */
    $.bind('command', function(event) {
        var sender = event.getSender(),
            command = event.getCommand(),
            argString = event.getArguments(),
            args = event.getArgs(),
            action = args[0];

        /**
         * @commandpath traffle [option] - Displays usage for the command
         */
        if (command.equalsIgnoreCase('traffle')) {
            if (!action) {
                $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.usage'));
                return;
            }

            /**
             * @commandpath traffle open [max entries] [regular ticket multiplier (default = 1)] [subscriber ticket multiplier (default = 1)] [cost] [-followers] - Opens a ticket raffle. -followers is optional.
             */
            if (action.equalsIgnoreCase('open')) {
                if (args[4] === undefined) {
                    checkArgs(sender, args[1], args[2], 1, 1, args[3]);
                } else {
                    checkArgs(sender, args[1], args[2], args[3], args[4], args[5]);
                }
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle close - Closes a ticket raffle.
             */
            if (action.equalsIgnoreCase('close')) {
                closeRaffle(sender);
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle draw - Picks a winner for the ticket raffle
             */
            if (action.equalsIgnoreCase('draw')) {
                winner();
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle undraw - Returns a winner to the raffle pool.
             */
            if (action.equalsIgnoreCase('undraw')) {
                if (!args[1]) {
                    $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.undraw.usage'));
                    return;
                }
                unwinner(args[1]);
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle absent - Marks a winner as absent.
             */
            if (action.equalsIgnoreCase('absent')) {
                if (!args[1]) {
                    $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.absent.usage'));
                    return;
                }
                absent(args[1]);
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle pass - Marks a winner as passed (like absent, but less shameful).
             */
            if (action.equalsIgnoreCase('pass')) {
                if (!args[1]) {
                    $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.pass.usage'));
                    return;
                }
                pass(args[1]);
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle reset - Resets the raffle.
             */
            if (action.equalsIgnoreCase('reset')) {
                var refund = winners.length == 0;
                if (refund) {
                    var costs = getAllTicketCosts();
                    for (var i in costs) {
                        $.inidb.incr('points', i, costs[i]);
                    }
                }

                clear();
                $.inidb.RemoveFile('ticketsList');
                $.inidb.RemoveFile('ticketCostList');
                $.inidb.RemoveFile('ticketBonusType');
                $.inidb.RemoveFile('ticketWinnersList');
                $.inidb.RemoveFile('ticketAbsenteeList');
                $.inidb.RemoveFile('entered');
                $.inidb.set('raffleresults', 'ticketRaffleEntries', 0);
                entries = [];
                winners = [];
                winnersCalledAt = {};
                absentees = [];
                if (sender != $.botName.toLowerCase()) {
                    $.say($.whisperPrefix(sender) + $.lang.get(refund ? 'ticketrafflesystem.reset.refund' : 'ticketrafflesystem.reset'));
                }
                updateTxtFiles();
                return;
            }

            /**
             * @commandpath traffle messagetoggle - Toggles on and off a message when entering a ticket raffle
             */
            if (action.equalsIgnoreCase('messagetoggle')) {
                if (msgToggle) {
                    msgToggle = false;
                    $.inidb.set('settings', 'tRaffleMSGToggle', msgToggle);
                    $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.msg.disabled'));
                } else {
                    msgToggle = true;
                    $.inidb.set('settings', 'tRaffleMSGToggle', msgToggle);
                    $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.msg.enabled'));
                }
                return;
            }

            /**
             * @commandpath traffle autoannouncemessage [message] - Sets the auto annouce message for when a raffle is opened
             */
            if (action.equalsIgnoreCase('autoannouncemessage')) {
                if (!args[1]) {
                    $.say($.whisperPrefix(sender) + $.lang.get('rafflesystem.auto.msg.usage'));
                    return;
                }

                raffleMessage = argString.replace(action, '').trim();
                $.inidb.set('settings', 'traffleMessage', raffleMessage);
                $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.auto.msg.set', raffleMessage));
                $.log.event(sender + ' changed the auto annouce message to ' + raffleMessage);
                return;
            }

            /**
             * @commandpath traffle autoannounceinterval [minutes] - Sets the auto annouce message interval. Use 0 to disable it
             */
            if (action.equalsIgnoreCase('autoannounceinterval')) {
                if (!parseInt(args[1])) {
                    $.say($.whisperPrefix(sender) + $.lang.get('rafflesystem.auto.msginterval.usage'));
                    return;
                }

                messageInterval = parseInt(args[1]);
                $.inidb.set('settings', 'traffleMessageInterval', messageInterval);
                $.say($.whisperPrefix(sender) + $.lang.get('ticketrafflesystem.auto.msginterval.set', messageInterval));
                $.log.event(sender + ' changed the auto annouce interval to ' + messageInterval);
                return;
            }

            /**
             * @commandpath traffle forceenter [user] [amount] - Forces a user to enter the raffle, as if they typed !tickets [amount]
             */
            if (action.equalsIgnoreCase('forceenter')) {
                var puppet = $.user.sanitize(args[1]);
                if (!$.user.isKnown(puppet)) {
                    return;
                }
                command = 'tickets';
                sender = puppet.toLowerCase();
                action = args[2];
                // FALL THROUGH
            }

            /**
             * @commandpath traffle forceleave [user] - Forces a user to leave the raffle, as if they typed !tickets leave
             */
            if (action.equalsIgnoreCase('forceleave')) {
                var puppet = $.user.sanitize(args[1]);
                if (!$.user.isKnown(puppet)) {
                    return;
                }
                command = 'tickets';
                sender = puppet.toLowerCase();
                action = 'leave';
                // FALL THROUGH
            }
        }

        /**
         * @commandpath tickets [amount] - Buy tickets to enter the ticket raffle.
         */
        if (command.equalsIgnoreCase('tickets') || command.equalsIgnoreCase('ticket')) {
            if (!action) {
                if (msgToggle && raffleStatus) {
                    $.say($.whisperPrefix(sender) + getTicketsUsageMessage(sender, event));
                }
                return;
            }
            if (action.equalsIgnoreCase('leave')) {
                leaveRaffle(sender);
                updateTxtFiles();
                return;
            }
            enterRaffle(sender, event, parseInt(action));
            updateTxtFiles();
            return;
        }
    });

    /**
     * @function getTicketsUsageMessage
     * @param {string} sender 
     * @param {$.CommandEvent} event 
     * @returns {string}
     */
    function getTicketsUsageMessage(sender, event) {
        var parts = [];
        var numTickets = getTickets(sender);
        if (numTickets > 0) {
            parts.push($.lang.get('ticketrafflesystem.ticket.usage.entries', numTickets, formatPercentage(numTickets / entries.length)));
        } else {
            parts.push($.lang.get('ticketrafflesystem.ticket.usage.entries.none'));
        }

        var bonus = calculateBonus(event);
        if (numTickets < bonus.maxEntries) {
            var ticketsToMax = bonus.maxEntries - numTickets;
            var preBonusTicketsToMax = ticketsToMax / bonus.multiplier;
            var costToMax = preBonusTicketsToMax * cost;
            if (preBonusTicketsToMax < 1) {
                // they missed some bonus due to rounding, need to leave and rejoin
                parts.push($.lang.get('ticketrafflesystem.ticket.usage.rebuy.rejoin', Math.floor(bonus.maxPoints / cost)));
            } else {
                var affordablePreBonusTicketsToMax = Math.min(preBonusTicketsToMax, Math.floor($.getUserPoints(sender) / cost));
                if (affordablePreBonusTicketsToMax > 0) {
                    var affordableTicketsToMax = Math.floor(affordablePreBonusTicketsToMax * bonus.multiplier);
                    parts.push($.lang.get('ticketrafflesystem.ticket.usage.rebuy', affordableTicketsToMax, Math.floor(affordablePreBonusTicketsToMax)));
                }
            }
            if (costToMax > $.getUserPoints(sender)) {  //XXX need a floor here?
                parts.push($.lang.get('ticketrafflesystem.ticket.usage.rebuy.nofunds', ticketsToMax, $.pointNameMultiple));
            }
        } else {
            parts.push($.lang.get('ticketrafflesystem.ticket.usage.rebuy.capped'));
        }

        if (numTickets > 0) {
            parts.push($.lang.get('ticketrafflesystem.ticket.usage.leave', $.getPointsString(getTicketCost(sender))));
        }

        return parts.join(' ');
    }

    /**
     * @function resumeRaffle
     */
    function resumeRaffle() {
        // TODO: restore winner state for closed raffles too
        raffleStatus = true;
        maxEntries = $.getIniDbNumber('traffleSettings', 'maxEntries');
        cost = $.getIniDbNumber('traffleSettings', 'cost');
        followers = $.getIniDbBoolean('traffleSettings', 'followers');
        regTMulti = $.getIniDbNumber('traffleSettings', 'regTMulti');
        subTMulti = $.getIniDbNumber('traffleSettings', 'subTMulti');

        entries.clear();
        var tickets = getAllTickets();
        for (var user in tickets) {
            for (var i = 0; i < tickets[user]; i++) {
                entries.push(user);
            }
        }

        startMessageInterval();
    }

    /**
     * @function updateTxtFiles
     * @returns {boolean}
     */
    function updateTxtFiles() {
        if (!useFiles) {
            return false;
        }

        var directory = './addons/traffle/';
        if (!$.isDirectory(directory)) {
            $.mkDir(directory);
        }

        var fileBuilders = {
            'status': buildStatusTxt,
            'entries': buildEntriesTxt,
            'winners': buildWinnersTxt,
            'sidebar': buildSidebarTxt
        };

        for (var key in fileBuilders) {
            var filename = directory + key + '.txt',
                builder = fileBuilders[key];

            var data = builder(key);
            if (typeof data !== 'string') {
                data = data.join('\n');
            }

            $.writeToFile(data, filename, false);
        }

        $.writeToFile(buildSidebarJson(), directory + 'sidebar.json', false);

        return true;
    }

    function buildStatusTxt() {
        var lines = [];
        lines.push('Raffle is ' + (raffleStatus ? 'OPEN' : 'CLOSED'));
        if (winners.length) {
            lines.push(winners.length + ' winner(s) drawn');
        }
        if (entries.length) {
            lines.push(entries.length + ' player(s) in pool');
        }
        return lines;
    }

    function buildEntriesTxt() {
        var lines = [];
        if (entries.length) {
            var keys = $.inidb.GetKeyList('ticketsList', '');
            for (var i in keys) {
                var tix = $.getIniDbNumber('ticketsList', keys[i]);
                lines.push(keys[i] + ' - ' + tix.toFixed(0) + ' ticket(s)');
            }
        }
        return lines;
    }

    function buildWinnersTxt() {
        return winners.length
            ? $.inidb.GetKeyList('ticketWinnersList', '')
            : [];
    }

    function buildSidebarTxt() {
        var lines = [];
        
        // TODO: custom message substitution ("this is a ventures raffle")
        var substitutions = {
            '(maxbuy)': maxEntries,
            '(ticketcost)': $.getPointsString(cost),
            '(regbonus)': regTMulti ? formatPercentage(regTMulti - 1) : null,
            '(subbonus)': subTMulti ? formatPercentage(subTMulti - 1) : null,
        };

        expandLines(raffleStatus ? 'open' : 'closed');

        if (winners.length) {
            expandLines('winners');
            // var keys = $.inidb.GetKeyList('ticketWinnersList', '');
            // for (var i in keys) {
            //     lines.push('  ' + keys[i]);
            // }
            for (var i in winners) {
                setSubstitutions(winners[i]);
                expandLines('winners.each');
            }
        }

        if (entries.length) {
            expandLines('entries');
            var keys = $.inidb.GetKeyList('ticketsList', '');
            for (var i in keys) {
                setSubstitutions(keys[i]);
                expandLines('entries.each');
            }
        }

        if (absentees.length) {
            expandLines('absentees');
            for (var i in absentees) {
                setSubstitutions(absentees[i]);
                expandLines('absentees.each');
            }
        }

        return lines;

        function expandLines(section) {
            var base = 'ticketrafflesystem.file.sidebar.';
            var key;
            for (var i = 1; $.lang.exists(key = (base + section + '.' + i)); i++) {
                expandOneLine($.lang.get(key));
            }
        }

        function expandOneLine(msg) {
            for (var sub in substitutions) {
                if (msg.indexOf(sub) !== -1) {
                    if (substitutions[sub] === null) {
                        return null;
                    }
                    msg = $.replace(msg, sub, substitutions[sub]);
                }
            }
            lines.push(msg);
        }

        function setSubstitutions(username) {
            substitutions['(username)'] = $.username.resolve(username);
            substitutions['(tickets)'] = getTickets(username) + '';

            var epic = $.epicLink && $.epicLink.getEpicName(username);
            substitutions['(epicname)'] = epic
                ? $.lang.get('ticketrafflesystem.winner.epic', epic)
                : $.lang.get('ticketrafflesystem.winner.noepic');
        }
    }

    function buildSidebarJson() {
        var epicEnabled = $.bot.isModuleEnabled('./custom/epicLink.js');
        var ratingEnabled = $.bot.isModuleEnabled('./custom/epicLink.js') && $.fortnitedb.isEnabled();

        var obj = {
            'config': {
                'open': raffleStatus,
                'title': 'Clown Car Raffle',
                'prize': 'A seat in this party',
                'finePrint': 'You must be present to win.',
                'waitedEnabled': true,
                'commands': {
                    'tickets': '!tickets',
                    'leave': '!leave',
                    'moreInfo': '!clowncar',
                },
                'points': {
                    'min': 1,
                    'max': maxEntries,
                    'regularBonus': regTMulti ? formatPercentage(regTMulti - 1) : undefined,
                    'subscriberBonus': subTMulti ? formatPercentage(subTMulti - 1) : undefined,
                },
                'inGame': {
                    'enabled': epicEnabled,
                    'handle': {
                        'name': 'Epic',
                        'missing': 'Use !setepic',
                    },
                    'rating': {
                        'enabled': ratingEnabled,
                        'name': '\u26a1',
                        'missing': 'Epic?',
                    },
                },
            },
            'winners': [],
            'entered': [],
            'notPresent': [],
            'passed': [],
        };

        function makeRow(username) {
            var result = {'name': $.username.resolve(username) + ''};
            var epic = epicEnabled && $.epicLink.getEpicName(username);
            if (epic) {
                result['inGame'] = { 'handle': epic + '' };
                if (ratingEnabled) {
                    result['inGame']['rating'] = $.fortnitedb.getPowerLevel(epic);
                }
            }
            return result;
        }

        if (winners && winners.length) {
            for (var i in winners) {
                var row = makeRow(winners[i]);
                obj['winners'].push(row);
            }
        }

        if (entries && entries.length) {
            var keys = $.inidb.GetKeyList('ticketsList', '');
            for (var i in keys) {
                var row = makeRow(keys[i]);
                row['tickets'] = getTickets(keys[i]);
                row['bonusType'] = getTicketBonusType(keys[i]);
                if (!row['tickets']) {
                    $.log.warn('Skipping sidebar row for ' + keys[i] + ' with 0 tickets');
                    continue;
                }
                obj['entered'].push(row);
            }
        }

        if (absentees && absentees.length) {
            for (var i in absentees) {
                var data = JSON.parse($.getIniDbString('ticketAbsenteeList', absentees[i], '{}'));
                var row = {
                    'name': $.username.resolve(absentees[i]) + '',
                    'tickets': data.winningTickets,
                    'waitedSeconds': data.waitedSeconds
                };
                if (!row['tickets']) {
                    $.log.warn('Skipping sidebar row for ' + keys[i] + ' with 0 tickets');
                    continue;
                }
                if (data.type === 'absent') {
                    obj['notPresent'].push(row);
                } else if (data.type === 'pass') {
                    obj['passed'].push(row);
                } else {
                    $.log.warn('Bad absentee type (' + data.type + ') for ' + absentees[i]);
                }
            }
        }

        return JSON.stringify(obj);
    }

    /**
     * @function formatPercentage
     * @param {number} fraction 
     * @returns {string}
     */
    function formatPercentage(fraction) {
        var pct = fraction * 100.0;
        var str;
        if (pct >= 100) {
            str = pct.toFixed(0);
        } else if (pct >= 10) {
            str = pct.toFixed(1);
        } else if (pct >= 1) {
            str = pct.toFixed(2);
        } else {
            str = pct.toFixed(3);
        }
        if (str.indexOf('.') >= 0) {
            str = str.replace(/\.?0+$/, '');
        }
        return str + '%';
    }

    /**
     * @event twitchOnline
     */
    $.bind('twitchOnline', function() {
        $.inidb.RemoveFile('traffleSessionWinners');
    });

    /**
     * @event initReady
     */
    $.bind('initReady', function() {
        $.registerChatCommand('./custom/ticketraffleSystem.js', 'traffle', 2);
        $.registerChatCommand('./custom/ticketraffleSystem.js', 'tickets', 7);
        $.registerChatCommand('./custom/ticketraffleSystem.js', 'ticket', 7);

        if ($.inidb.get('traffleSettings', 'isActive') === 'true') {
            resumeRaffle();
        } else {
            $.inidb.set('traffleSettings', 'isActive', 'false');
            $.inidb.set('raffleresults', 'ticketRaffleEntries', 0);
            $.inidb.RemoveFile('ticketsList');
            $.inidb.RemoveFile('ticketCostList');
            $.inidb.RemoveFile('ticketBonusType');
            $.inidb.RemoveFile('ticketWinnersList');
            $.inidb.RemoveFile('entered');
        }
        updateTxtFiles();
    });

    $.reloadTRaffle = reloadTRaffle;
    $.writeTRaffleTxtFiles = updateTxtFiles;
})();
