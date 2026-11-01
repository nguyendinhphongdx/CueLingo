import XCTest
@testable import LocalSTT

final class VocabularyCorrectorTests: XCTestCase {
    func testFixesAcronymWithStrayLetter() {
        let corrector = VocabularyCorrector(terms: ["SLA"])
        XCTAssertEqual(corrector.correct("I think the slaw is too tight."), "I think the SLA is too tight.")
        XCTAssertEqual(corrector.correct("Is the slaw? yes"), "Is the SLA? yes")
    }

    func testRestoresCasing() {
        XCTAssertEqual(VocabularyCorrector(terms: ["SLA"]).correct("the sla is tight"), "the SLA is tight")
    }

    func testLeavesUnrelatedWordsAlone() {
        let corrector = VocabularyCorrector(terms: ["SLA"])
        XCTAssertEqual(corrector.correct("The slate is on the table"), "The slate is on the table")
        XCTAssertEqual(corrector.correct("That is a law"), "That is a law")
    }

    func testFixesNearMissOfLongerTerm() {
        let corrector = VocabularyCorrector(terms: ["Kubernetes"])
        XCTAssertEqual(corrector.correct("deploy to kubernetis today"), "deploy to Kubernetes today")
    }

    func testNoTermsIsIdentity() {
        XCTAssertEqual(VocabularyCorrector(terms: []).correct("anything goes"), "anything goes")
    }
}
