RM		= rm -f
UGLIFY		= uglifyjs
SOURCES		= js/MARender.js js/MAVTKLoader.js
MINIFIED	= $(SOURCES:%.js=%.min.js)

all:		$(MINIFIED)

clean:
		$(RM) $(MINIFIED)

%.min.js:	%.js
		$(UGLIFY) -c -- $< > $@
