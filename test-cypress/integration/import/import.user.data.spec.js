import ImportSteps from '../../steps/import-steps';

describe('Import screen validation - user data', () => {

    let repositoryId;

    const RDF_TEXT_SNIPPET_1 = '@prefix d:<http://learningsparql.com/ns/data#>.\n' +
        '@prefix dm:<http://learningsparql.com/ns/demo#>.\n\n' +
        'd:item342 dm:shipped "2011-02-14"^^<http://www.w3.org/2001/XMLSchema#date>.\n' +
        'd:item342 dm:quantity 4.\n' +
        'd:item342 dm:invoiced true.\n' +
        'd:item342 dm:costPerItem 3.50.';

    const RDF_TEXT_SNIPPET_2 = '@prefix ab:<http://learningsparql.com/ns/addressbook#>.\n\n' +
        'ab:richard ab:homeTel "(229)276-5135".\n' +
        'ab:richard ab:email "richard49@hotmail.com".\n' +
        'ab:richard ab:email "richard491@hotmail.com".';

    const BASE_URI = 'http://purl.org/dc/elements/1.1/';
    const CONTEXT = 'http://example.org/graph';

    const IMPORT_URL = 'https://www.w3.org/TR/owl-guide/wine.rdf';
    const TEXT_SNIPPET = 'Text snippet';
    const INVALID_URL_RDF_FORMAT = 'JSON-LD';
    const VALID_URL_RDF_FORMAT = 'RDF/XML';
    const VALID_SNIPPET_RDF_FORMAT = 'Turtle';
    const RDF_ERROR_MESSAGE = 'RDF Parse Error:';
    const SUCCESS_MESSAGE = 'Imported successfully';

    beforeEach(() => {
        repositoryId = 'user-import-' + Date.now();
        cy.createRepository({id: repositoryId});
        ImportSteps.visitUserImport(repositoryId);
    });

    afterEach(() => {
        ImportSteps.removeUploadedFiles();
        cy.deleteRepository(repositoryId);
    });

    it('Test import file via URL successfully with Auto format selected', () => {
        ImportSteps
            .openImportURLDialog(IMPORT_URL)
            .clickImportUrlButton()
            // Without changing settings
            .importFromSettingsDialog()
            .verifyImportStatus(IMPORT_URL, SUCCESS_MESSAGE);
    });

    it('Test import file via URL with invalid RDF format selected', () => {
        ImportSteps
            .openImportURLDialog(IMPORT_URL)
            .selectRDFFormat(INVALID_URL_RDF_FORMAT)
            .clickImportUrlButton()
            .importFromSettingsDialog()
            .verifyImportStatus(IMPORT_URL, RDF_ERROR_MESSAGE);
    });

    it('Test import file via URL successfully with valid RDF format selected', () => {
        ImportSteps
            .openImportURLDialog(IMPORT_URL)
            .selectRDFFormat(VALID_URL_RDF_FORMAT)
            .clickImportUrlButton()
            .importFromSettingsDialog()
            .verifyImportStatus(IMPORT_URL, SUCCESS_MESSAGE);
    });

    it('Test import RDF text snippet successfully with Auto format selected', () => {
        ImportSteps
            .openImportTextSnippetDialog()
            .fillRDFTextSnippet(RDF_TEXT_SNIPPET_1)
            .clickImportTextSnippetButton()
            .importFromSettingsDialog()
            .verifyImportStatus(TEXT_SNIPPET, SUCCESS_MESSAGE);
    });

    it('Test import RDF text snippet with invalid RDF format selected', () => {
        ImportSteps
            .openImportTextSnippetDialog()
            .fillRDFTextSnippet(RDF_TEXT_SNIPPET_1)
            .selectRDFFormat(INVALID_URL_RDF_FORMAT)
            .clickImportTextSnippetButton()
            .importFromSettingsDialog()
            .verifyImportStatus(TEXT_SNIPPET, RDF_ERROR_MESSAGE);
    });

    it('Test import RDF text snippet successfully with valid RDF format selected', () => {
        ImportSteps
            .openImportTextSnippetDialog()
            .fillRDFTextSnippet(RDF_TEXT_SNIPPET_1)
            .selectRDFFormat(VALID_SNIPPET_RDF_FORMAT)
            .clickImportTextSnippetButton()
            .importFromSettingsDialog()
            .verifyImportStatus(TEXT_SNIPPET, SUCCESS_MESSAGE);
    });

    it('Test import RDF text snippet successfully with filled base URI and context', () => {
        ImportSteps
            .openImportTextSnippetDialog()
            .fillRDFTextSnippet(RDF_TEXT_SNIPPET_2)
            .clickImportTextSnippetButton()
            .fillBaseURI(BASE_URI)
            .selectNamedGraph()
            .fillNamedGraph(CONTEXT)
            .importFromSettingsDialog()
            .verifyImportStatus(TEXT_SNIPPET, SUCCESS_MESSAGE);

        // TODO: Refactor

        // Go to Graphs overview
        cy.navigateToPage('Explore', 'Graphs overview');
        let graphName = CONTEXT.slice(0, CONTEXT.lastIndexOf('.'));
        // Verify that created graph is found
        cy.get('.form-control').type(graphName);
        cy.get('#export-graphs').should('be.visible').should('contain', graphName);

        // Should return to initial url in order after each block of the tests to be executed
        cy.navigateToPage('Import', 'RDF');
    });
});
