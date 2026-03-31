# MIV Functional Checklist

Use a scratch file with:

## Modes And UI

## Motion

## Insert Entry

## Editing

- [x] `§` toggle case at cursor - vi kanske ska byta till <
- [x] `5§` toggle counted chars  vi kanske ska byta till 5<
- [x] `shift+§` toggle case for word - nej den verkar vara flyttat till shift + >
- [x] `3shift+§` toggle counted words - ja, men den är flyttad till shift + > 
- [x] `%` jump bracket match - ja men inte på ",
- [x] `&` join with next line, borde fungera med J också
- [x] `.` repeat alias - dock inte för alla kommandon

## Search

- [x] `ESC` clears visible highlights but keeps search history - nej den verkar inte fungera

## Replace. {"hello"}, "world"

- [x] `.` re-applies current replace rule - jag funderar om om vi skall ta alla kommandon som inte är rörelse WASDQEM. en klassiker i vim. Den ska nog inte heller vara påverkad av searhc och replace
- [x] Replace still dog after a dog literal search. 
- [x] Replace still works after a previous regex search
test

Överlag tycker jag att history är lite konstig sedan vi ändrade beteende på ESC

## Registers

## Text ObJects
- [x] `!y`
- [x] `" 3y`.   {"hello"}.    ['hello', 'world']
- [x] `( 2x`
- [x] `{ 5p`
- [x] Simple delimiter scan works without nesting - den verkar fastna på en del saker som " så går den till något annat. som {}

## Helpers And VS Code Integration
