# Abstract

Edin js is a small backend-agnostic realtime data synchronisation library for javascript.

It provides easy to implement API whitch can hook up to any backend in just a few lines of code.
All you need to do is implement EdinBackend interface and create instance of EdinFactory with your backend implementation.

# Bulletproof

Edin uses the most simple and robust method of fighting annoying desyncs - versioning. 
Each edin doc has a version attached to it whitch increments every time any update is made. 
If client recieves update that is not the next version it would just sync data with server.

# TODO

* P2P support
* Version Control Support
* Backend implementations for different languages