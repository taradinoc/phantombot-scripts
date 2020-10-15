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

$.lang.register('ticketrafflesystem.err.raffle.opened', 'A ticket raffle is already opened.');
$.lang.register('ticketrafflesystem.err.missing.syntax', 'Usage: !traffle open [max entries] [regulars ticket multiplier (default = 1)] [subscribers ticket multiplier (default = 1)] [cost] [-followers]');
$.lang.register('ticketrafflesystem.msg.need.to.be.follwing', 'You need to be following to enter.');
$.lang.register('ticketrafflesystem.raffle.opened', 'Ticket raffle is now open! Buy up to $1 tickets with !tickets - you can purchase multiple times. Tickets cost $2. $3');
$.lang.register('ticketrafflesystem.err.raffle.not.opened', 'There is no ticket raffle opened.');
$.lang.register('ticketrafflesystem.raffle.closed', 'The ticket raffle is now closed. Use "!traffle draw" to draw a winner.');
$.lang.register('ticketrafflesystem.raffle.close.err', 'The ticket raffle ended. No one entered.');
$.lang.register('ticketrafflesystem.winner', 'The winner of this ticket raffle is: $1! $2 $3');
$.lang.register('ticketrafflesystem.only.buy.amount', 'You can only buy $1 ticket(s)');
$.lang.register('ticketrafflesystem.limit.hit', 'You\'re only allowed to buy $1 ticket(s)');
$.lang.register('ticketrafflesystem.err.not.following', 'You need to be following to enter.');
$.lang.register('ticketrafflesystem.err.points', 'You don\'t have enough $1 to enter.');
$.lang.register('ticketrafflesystem.entered', '$1 entries added to the ticket raffle! ($2 tickets in total)');
$.lang.register('ticketrafflesystem.usage', 'Usage: !traffle open [max entries] [regulars ticket multiplier (default = 1)] [subscribers ticket multiplier (default = 1)] [cost] [-followers]');
$.lang.register('ticketrafflesystem.msg.enabled', 'Ticket raffle messages have been enabled.');
$.lang.register('ticketrafflesystem.msg.disabled', 'Ticket raffle messages have been disabled.');
$.lang.register('ticketrafflesystem.ticket.usage', 'Usage: !tickets (amount), or !tickets leave - And you currently have $1 tickets.');
//TODO
// $.lang.register('ticketrafflesystem.ticket.usage', 'You have $1 ticket(s) entered in this raffle, giving you a $2 chance to win. $3$4 ');
// $.lang.register('ticketrafflesystem.ticket.usage.rebuy.max', 'You can get the maximum of $1 tickets by typing !tickets $2.');
// $.lang.register('ticketrafflesystem.ticket.usage.rebuy.partial', 'With your $1, you can afford to get a total of $2 tickets) by typing !tickets $2.');
$.lang.register('ticketrafflesystem.auto.msginterval.set', 'Message interval set to $1 minutes.');
$.lang.register('ticketrafflesystem.auto.msg.set', 'Message set to $1.');
$.lang.register('ticketrafflesystem.auto.msg.usage', 'Usage: !traffle autoannouncemessage [amount in minutes]');
$.lang.register('ticketrafflesystem.auto.msginterval.usage', 'Usage: !traffle autoannounceinterval [amount in minutes]');
$.lang.register('ticketrafflesystem.reset', 'The raffle has been reset.');

$.lang.register('ticketrafflesystem.enter.confirm', 'You have entered the raffle with $1 ticket(s). Good luck!');
$.lang.register('ticketrafflesystem.enter.reconfirm', 'You have added $1 raffle ticket(s), and you now have a total of $2.');
$.lang.register('ticketrafflesystem.unwinner', 'Removing $1 as raffle winner and returning them to the pool with $2 ticket(s).');
$.lang.register('ticketrafflesystem.unwinner.err', 'Failed to remove $1 as raffle winner because they have no winning tickets.');
$.lang.register('ticketrafflesystem.undraw.usage', 'Usage: !traffle undraw [winner].');
$.lang.register('ticketrafflesystem.raffle.close.nomore', 'The ticket raffle ended. Everybody won!');
$.lang.register('ticketrafflesystem.reset.refund', 'The raffle has been cancelled. Entry costs have been refunded.');
$.lang.register('ticketrafflesystem.enter.setepic', 'For faster service, please also link your Epic name using the !setepic command.');
$.lang.register('ticketrafflesystem.winner.epic', '[Epic: $1]');
$.lang.register('ticketrafflesystem.winner.noepic', '[Epic not set]');

$.lang.register('ticketrafflesystem.absent.usage', 'Usage: !traffle absent [winner].');
$.lang.register('ticketrafflesystem.absent.err', 'Failed to mark $1 absent because they have no winning tickets.');
$.lang.register('ticketrafflesystem.absent', 'Removing $1 as winner for being absent. You must be present to win!');

$.lang.register('ticketrafflesystem.sessionwins.1', 'This is $1\'s first win this stream. Congratulations!');
$.lang.register('ticketrafflesystem.sessionwins.2', '$1 has won twice this stream.');
$.lang.register('ticketrafflesystem.sessionwins.3', '$1 has won 3 times this stream. Hmm.');
$.lang.register('ticketrafflesystem.sessionwins', '$1 has won $2 times this stream. RIGGED!');

$.lang.register('ticketrafflesystem.leave.err.not.entered', 'You have no entries in the raffle anyway.');
$.lang.register('ticketrafflesystem.leave', 'You have been removed from the raffle. Refunded $1.');

$.lang.register('ticketrafflesystem.file.sidebar.closed.1', 'Raffle is CLOSED.');

$.lang.register('ticketrafflesystem.file.sidebar.open.1', '*** Raffle is OPEN! ***');
$.lang.register('ticketrafflesystem.file.sidebar.open.2', '');
$.lang.register('ticketrafflesystem.file.sidebar.open.3', 'TO JOIN, type:    !tickets 1');
$.lang.register('ticketrafflesystem.file.sidebar.open.4', '...or go up to:   !tickets (maxbuy)');
$.lang.register('ticketrafflesystem.file.sidebar.open.5', '');
$.lang.register('ticketrafflesystem.file.sidebar.open.6', 'Each ticket costs (ticketcost).');
$.lang.register('ticketrafflesystem.file.sidebar.open.7', '\nRegulars get a (regbonus) bonus.');
$.lang.register('ticketrafflesystem.file.sidebar.open.8', '\nSubscribers get a (subbonus) bonus!');

$.lang.register('ticketrafflesystem.file.sidebar.winners.1', '\n*** Winners ***');
$.lang.register('ticketrafflesystem.file.sidebar.winners.each.1', '  (username) (epicname)');

$.lang.register('ticketrafflesystem.file.sidebar.entries.1', '\n*** Players Entered ***');
$.lang.register('ticketrafflesystem.file.sidebar.entries.each.1', '(username) ((tickets))');

$.lang.register('ticketrafflesystem.file.sidebar.absentees.1', '\n*** Not Present When Called ***');
$.lang.register('ticketrafflesystem.file.sidebar.absentees.each.1', '(username)');
