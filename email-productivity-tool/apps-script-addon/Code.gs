function onOpen(e) {
  CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Productivity Tool'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('Welcome!')))
    .build();
}
