# EDIN Syncronization Model description.

## Abstract

Edin is an syncronization model for keeping realtime data in 
sync across multiple clients while also keeping data up-to-date on server.

## General structure

One chunk of syncronizable data is called document (or EdinDoc). 

Each document concists of the following fields:

* id - Unique identifier used to access document.
* version - Current version of document. Each time document is updated version is incremented by 1.
* content - Data of document represented as JSON.

Both server and client store documents.
Server stores all documents. Client stores only documents it is interested in.

## Server API

Server must provide following methods:

### get_document

Arguments:

* id - Document Identifier.
* content - Default content of document.

If document is present in database (distinguished by id) server returns cached version of document.

If document is not present in database server creates document with given id and content. Initial version is 0.
Then server returns newly created document.

### update_document

Arguments:

* id - Document Identifier.
* patch - Changes that should be applied to document represented as Json Patch Document (RFC 6902)
* version - Version of document that changes were based of

If document is not present in database server returns an error.

Otherwise server tries to apply patch to content of document. 
If any of the patch operations fail server returns an error and does not update document.

If patch was successful server document is updated accordingly and version is incremented by 1. 
Then server sends out notification to all subscribed clients except sender with following contents:

* id - Document Identifier
* patch - The same patch that came in
* version - Current version of document after patch

Comments:
1) Subscriptions may be implemented in any way, be it subscription to specific documents or not.
2) Version that comes from client is ignored purposely. Any valid updates are to be applied independent on version to ensure that most updates are aknowledged, even concurrent ones as long as they are not conflicting. 

### remove_document

Arguments:

* id - Document Identifier.

If document is not present in database server returns an error. 
Otherwise server removes document wiping all it's contents and freeing id.
Then server sends out remove notification to all subscribed clients except sender with id of removed document.

## Client API

Client must be able to recieve notifications from server and provide following notification handlers:

### on_update_document

Arguments: Notification sent by update_document method.

If document is not present on local database notification is ignored. 

If version of update does not equal current local version of document + 1 that means that document is out of sync.
Then client invokes get_document to get current version of document and overrides local version completely.

Otherwise document is updated according to Json Patch and version is incremented (or set to server version whitch is the same).

### on_remove_document

Arguments: Notification sent by remove_document method.

If document is not present on local database notification is ignored.

Otherwise local document is wiped from local database.

Client is expected to behave differently depending on the invocation results of server API.

### update_document

If update_document fails with reason being "unappliable patch" get_document must be invoked and local document should be overriden.