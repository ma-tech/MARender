UGLIFY		= uglifyjs
SOURCES		= js/MARender.js
LIBRARY		= js/MARender.min.js

all:		$(LIBRARY)

$(LIBRARY):	$(SOURCES)
		$(UGLIFY) -c -- $(SOURCES) >$(LIBRARY)
