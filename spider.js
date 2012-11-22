#!/usr/local/bin/node
var mongo = require('mongodb'),
	Server = mongo.Server,
	Db = mongo.Db,
	Collection = mongo.Collection,
	fs = require('fs'),
	pdf = require('pdfcrowd_free'),
	client = new pdf.Pdfcrowd('');

var server = new Server('localhost', 27017, {"auto_reconnect": false}),
	db = new Db('rss2email', server, {"safe": false});

function stopScript() {
	setTimeout(function () {
		db.close();
	}, 2000);
}

db.open(function (err, db) {
	"use strict";
	if (err) {
		console.error("We are not connected");
		return;
	}

	var subscriptionCollection = new Collection(db, 'subscription');

	subscriptionCollection.find(function (err, cursor) {
		if (err) {
			db.close();
			return;
		}
		cursor.each(function (err, subscription) {
			if (err || subscription === null) {
				stopScript();
				return;
			}
			
			runUrlParser(subscription);
		});
	});
});

function runUrlParser(subscription) {
	var FeedParser = require('feedparser'),
		parser = new FeedParser();

	console.log('parsing url ' + subscription.url);
	parser.parseUrl(subscription.url, function onParseUrl(err, meta, article) {
		"use strict";
		meta.link = subscription.url;

		var newsCollection = new Collection(db, 'rss_news'),
			articlesCollection = new Collection(db, 'rss_articles'),
			i;

		console.log('update rss ' + meta.link);
		newsCollection.update({"link": meta.link}, meta, {"safe": false, "upsert": true});

		for (i in article) {
			article[i].rss = meta.link;
			console.log('insert ' + article[i].link + ' to articles');
			articlesCollection.insert(article[i], {"safe": false});

			var file = __dirname + '/files/' + article[i].link.replace(/http[s]*:\/\//, '').replace(/\/$/, '').replace(/[^\w]/g, '_') + '.pdf';
			if (fs.existsSync(file)) {
				console.log(file + ' already exists');
			} else {
				client.convertURI(article[i].link, pdf.saveToFile(file));
			}
		}
	});
}
