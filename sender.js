#!/usr/local/bin/node
var nodemailer = require("nodemailer"),
	mongo = require('mongodb'),
	Server = mongo.Server,
	Db = mongo.Db,
	Collection = mongo.Collection,
	fs = require('fs'),

	server = new Server('localhost', 27017, {"auto_reconnect": false}),
	db = new Db('rss2email', server, {"safe": false});

var sendRequestQueue = {
	init: function () {
		this.queue = [];
		this.working = 0;
	},

	addRequest: function (req) {
		this.queue.push(req);
		this.processRequest();
	},

	requestDone: function () {
		this.working = 0;
		this.processRequest();
	},

	processRequest: function () {
		if (this.queue.length > 0 && !this.working) {
			this.working = 1;
			var args = this.queue.shift();
			sendEmail(args);
		}
	}
};

function sendEmail(opts) {
	"use strict";
	
	var subscription = opts.subscription,
		transport = nodemailer.createTransport("SMTP", {
			service: 'Gmail',
			auth: {
				user: "",
				pass: ""
			}
		});

	var mailOptions = {
		from: "rss2email",
		to: subscription.email,
		subject: opts.subject,
		text: opts.body,
		html: opts.body
	};

	if (opts.attachments.length > 0) {
		mailOptions.attachments = opts.attachments;
	}

	console.log('process mail for subscription ' + subscription.url);

	var subscriptionCollection = new Collection(db, 'subscription');
	console.log('update subscription ' + subscription._id + ' and set last_article_date to ' + subscription.last_article_date);
	subscriptionCollection.update({"_id": subscription._id}, {$set: {"last_article_date": subscription.last_article_date}});

	transport.sendMail(mailOptions, function (error, response) {
		if (error) {
			console.log(error);
		} else {
			console.log("Message sent to " + mailOptions.to + ": " + response.message);
		}
		sendRequestQueue.requestDone();
		transport.close();
	});
}

/**
 * @param schedule
 * @return {Date}
 */
function getNextDate(schedule) {
	"use strict";
	if (typeof schedule !== 'object') {
		return new Date();
	}

	var nextDayData = {
			'Mon': 1,
			'Tue': 2,
			'Wed': 3,
			'Thu': 4,
			'Fri': 5,
			'Sat': 6,
			'Sun': 7
		},
		i, n,
		date = new Date(),
		currentDay = /^[\w]{3}/.exec(date.toGMTString())[0],

		iteration = 0,
		dayDiff = 0,
		nextDay;

	do {
		iteration += 1;
		for (i in nextDayData) {
			if (iteration === 1 && nextDayData[i] <= nextDayData[currentDay]) {
				continue;
			}
			dayDiff += 1;
			if (typeof schedule[i] === 'string') {
				nextDay = i;
				break;
			}
		}
	} while (iteration <= 2 && typeof nextDay !== 'string');

	var nextDatetime = new Date(date.getTime() + (1000 * 60 * 60 * 24 * dayDiff));

	return new Date(nextDatetime.toGMTString().replace(/[\d]+:[\d]+/, schedule[nextDay]));
}

function stopScript() {
	"use strict";
	setTimeout(function () {
		db.close();
	}, 6000);
}

db.open(function (err, db) {
	"use strict";
	if (err) {
		console.error("We are not connected");
		return;
	}

	var subscriptionCollection = new Collection(db, 'subscription'),
		FeedParser = require('feedparser'),
		parser = new FeedParser();

	sendRequestQueue.init();

	subscriptionCollection.find({"next_send_time": {$lt: new Date()}}, function (err, cursor) {
		if (err) {
			console.log("error with subscriptions");
			db.close();
			return;
		}
		cursor.each(function (err, subscription) {
			if (err || subscription === null) {
				stopScript();
				return;
			}

			console.log("work with subscription " + subscription.url);

			findNews(subscription);

			subscriptionCollection.update({"_id": subscription._id}, {$set: {"next_send_time": getNextDate(subscription.schedule)}});
		});
	});
});

function findNews(subscription) {
	if (typeof subscription.url === 'undefined') {
		return;
	}

	var newsCollection = new Collection(db, 'rss_news');
	console.log('search news by url ' + subscription.url);
	newsCollection.find({"link": subscription.url}, function (err, cursor) {
		if (err) {
			return;
		}

		cursor.each(function (err, news) {
			if (err || news === null) {
				return;
			}

			console.log('start findArticles to subscription ' + subscription.url + ' AND news ' + news.link);

			findArticles(subscription, news);
		});
	});
}

function findArticles(subscription, news) {
	var articles = new Collection(db, 'rss_articles'),
		opts = {
			subscription: subscription,
			subject: news.title,
			body: '',
			attachments: []
		};

	console.log('search article by params: url = ' + subscription.url + ' and date > ' + subscription.last_article_date);

	articles.find({"rss": subscription.url, "date": {$gt: subscription.last_article_date}}, {"sort": [["pubdate", "desc"]]}, function (err, cursor) {
		if (err) {
			return;
		}

		var last_article_date = null;
		cursor.each(function (err, article) {
			if (article === null) {
				if (opts.body === '') {
					console.log("body is empty");
				} else {
					opts.subscription.last_article_date = last_article_date;
					sendRequestQueue.addRequest(opts);
				}
			} else {
				if (last_article_date === null) {
					console.log('set last_article_date to ' + article.pubdate);
					last_article_date = article.pubdate;
				}
				//console.log("append " + article.title + " to body of email");
				opts.body += '<div  style="margin-bottom:10px;">';
				opts.body += '<div style="padding:5px 0;font-weight:bold"><a href="' + article.link + '">' + article.title + '</a></div>';
				opts.body += '<div style="padding-bottom:5px;color:#bbbbbb;font-style:italic">' + article.pubdate + '</div>';
				opts.body += '<div style="background:#f3f3f3;border:1px dotted #bbbbbb>' + article.description + '</div>';
				opts.body += '</div>';

				if (typeof subscription.settings.pdf !== 'undefined' && subscription.settings.pdf === true) {
					var fileName = article.link.replace(/http[s]*:\/\//, '').replace(/\/$/, '').replace(/[^\w]/g, '_') + '.pdf';
					var filePath = __dirname + '/files/' + fileName;
					if (fs.existsSync(filePath)) {
						opts.attachments.push({
							fileName: fileName,
							filePath: filePath,
							cid: fileName + '@node'
						});
					}
				}
			}
		});
	});
}
