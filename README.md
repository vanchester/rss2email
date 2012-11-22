rss2email
=========

## ABOUT

This is the tools to collect information from your RSS-feeds and send it for you via e-mail.
Tools wrote with node.js and use MongoDB

## INSTALLATION

* Install node.js if you have not (http://nodejs.org/)
* Install MondoDB (http://www.mongodb.org/downloads)
* Clone this repo (git clone https://github.com/vanchester/rss2email)
* Run "npm install" command in console to download extensions that script needed
* Add "node /path/to/rss2email/spider.js" to cron
* Add "node /path/to/rss2email/sender.js" to cron

Before site-interface not ready, you can add address of your RSS-feeds via console of MongoDB

Sample of collections:

	> db.user.findOne()
	{
		"_id" : "admin@vanchester.ru",
		"password" : "",
		"reg_date" : ISODate("1970-01-01T00:00:00Z")
	}
	> db.subscription.findOne()
	{
		"_id" : ObjectId("509047bafe5333998ac566ef"),
		"email" : "admin@vanchester.ru",
		"last_article_date" : ISODate("2012-11-22T00:29:31Z"),
		"next_send_time" : ISODate("2012-11-22T03:30:01.879Z"),
		"schedule" : "now",
		"settings" : {
			"pdf" : true
		},
		"url" : "http://habrahabr.ru/rss/feed/posts/"
	}

