/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface HazeSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: HazeSettings = { maxNumberOfProblems: 1000 };
let globalSettings: HazeSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<HazeSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <HazeSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

function getDocumentSettings(resource: string): Thenable<HazeSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'haze-ls'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});


connection.languages.diagnostics.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (document !== undefined) {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: await validateTextDocument(document)
		} satisfies DocumentDiagnosticReport;
	} else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: []
		} satisfies DocumentDiagnosticReport;
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	// while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
	// 	problems++;
	// 	const diagnostic: Diagnostic = {
	// 		severity: DiagnosticSeverity.Warning,
	// 		range: {
	// 			start: textDocument.positionAt(m.index),
	// 			end: textDocument.positionAt(m.index + m[0].length)
	// 		},
	// 		message: `${m[0]} is all uppercase.`,
	// 		source: 'ex'
	// 	};
	// 	if (hasDiagnosticRelatedInformationCapability) {
	// 		diagnostic.relatedInformation = [
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Spelling matters'
	// 			},
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Particularly for names'
	// 			}
	// 		];
	// 	}
	// 	diagnostics.push(diagnostic);
	// }
	return diagnostics;
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

enum TokenKind {
	//declarators
	Function,
	//interpreter-specific
	Intrinsic,
	Geometry,

	//type specifiers
	Byte,
	String,
	Nvr,

	//control flow
	Return,
	While,
	For,
	If,
	Else,

	//??
	Asm,
	Print,


	//dotdirectives
	Dotmacro,
	Dotdefine,
	Dotorg,
	//interpreter-specific
	Dothook,
	Dotunhook,

	//registers
	R0,
	R1,
	R2,
	R3,

	//assembly opcodes
	Move,
	Load,
	Copy,
	Save,
	Iadd,
	Isub,
	Band,
	Bior,
	Bxor,
	Call,
	Exit,
	Push,
	Pull,
	Brnz,
	Bool,
	//0xF reserved for future ISA extensions

	
}




// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			//declarators
			{
				label: 'function',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Function
			},
			//interpreter-specific
			{
				label: 'intrinsic',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Intrinsic
			},
			{
				label: 'geometry',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Geometry
			},


			//type specifiers
			{
				label: 'byte',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Byte
			},
			{
				label: 'string',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.String
			},
			{
				label: 'nvr',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Nvr
			},


			//control flow
			{
				label: 'return',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Return
			},
			{
				label: 'while',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.While
			},
			{
				label: 'for',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.For
			},
			{
				label: 'if',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.If
			},
			{
				label: 'else',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Else
			},

			
			//??
			{
				label: 'asm',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Asm
			},
			{
				label: 'print',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Print
			},


			//dotdirectives
			{
				label: '.macro',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Dotmacro
			},
			{
				label: '.define',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Dotdefine
			},
			{
				label: '.org',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Dotorg
			},
			//interpreter-specific
			{
				label: '.hook',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Dothook
			},
			{
				label: '.unhook',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Dotunhook
			},

			
			//registers
			{
				label: 'r0',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.R0
			},
			{
				label: 'r1',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.R1
			},
			{
				label: 'r2',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.R2
			},
			{
				label: 'r3',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.R3
			},


			//assembly opcodes
			{
				label: 'move',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Move
			},
			{
				label: 'load',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Load
			},
			{
				label: 'save',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Save
			},
			{
				label: 'copy',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Copy
			},
			{
				label: 'iadd',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Iadd
			},
			{
				label: 'isub',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Isub
			},
			{
				label: 'band',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Band
			},
			{
				label: 'bior',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Bior
			},
			{
				label: 'bxor',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Bxor
			},
			{
				label: 'call',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Call
			},
			{
				label: 'exit',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Exit
			},
			{
				label: 'push',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Push
			},
			{
				label: 'pull',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Pull
			},
			{
				label: 'brnz',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Brnz
			},
			{
				label: 'bool',
				kind: CompletionItemKind.Keyword,
				data: TokenKind.Bool
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		switch (item.data) {
			//declarators
			case TokenKind.Function: {
				item.detail = 'function';
				item.documentation = 'function {typename} {identifier} = ( {arguments} ) {statement}';
			} break;
			//interpreter-specific
			case TokenKind.Intrinsic: {
				item.detail = 'intrinsic';
				item.documentation = 'intrinsic {identifier} = {value};';
			} break;
			case TokenKind.Geometry: {
				item.detail = 'geometry';
				item.documentation = 'geometry {WIP};';
			} break;


			//type specifiers
			case TokenKind.Byte: {
				item.detail = 'byte';
				item.documentation = 'byte {identifier} = {expression};';
			} break;
			case TokenKind.String: {
				item.detail = 'string';
				item.documentation = 'string {identifier} = "{text}";';
			} break;
			case TokenKind.Nvr: {
				item.detail = 'nvr';
				item.documentation = 'function nvr {identifier} = ...';
			} break;


			//control flow
			case TokenKind.Return: {
				item.detail = 'return';
				item.documentation = 'return {expression};';
			} break;
			case TokenKind.While: {
				item.detail = 'while';
				item.documentation = 'while ({expression}) {statement}';
			} break;
			case TokenKind.For: {
				item.detail = 'for';
				item.documentation = 'for ({statement}; {expression}; {expression}) {statement}';
			} break;
			case TokenKind.If: {
				item.detail = 'if';
				item.documentation = 'if ({expression}) {statement}';
			} break;
			case TokenKind.Else: {
				item.detail = 'else';
				item.documentation = 'if ... else {statement}';
			} break;


			//??
			case TokenKind.Asm: {
				item.detail = 'asm';
				item.documentation = 'asm { {commands} }';
			} break;
			case TokenKind.Print: {
				item.detail = 'print';
				item.documentation = 'print({expression});';
			} break;


			//dotdirectives
			case TokenKind.Dotmacro: {
				item.detail = '.macro';
				item.documentation = '.macro {identifier} = ({arguments}): { {substitutions} }';
			} break;
			case TokenKind.Dotdefine: {
				item.detail = '.define';
				item.documentation = '.define {identifier} = {constexpr}';
			} break;
			case TokenKind.Dotorg: {
				item.detail = '.dotorg';
				item.documentation = '.dotorg {address}';
			} break;

			//interpreter-specific
			case TokenKind.Dothook: {
				item.detail = '.hook';
				item.documentation = '.hook';
			} break;
			case TokenKind.Dotunhook: {
				item.detail = '.unhook';
				item.documentation = '.unhook';
			} break;


			//registers
			case TokenKind.R0: {
				item.detail = 'r0';
				item.documentation = 'r0';
			} break;
			case TokenKind.R1: {
				item.detail = 'r1';
				item.documentation = 'r1';
			} break;
			case TokenKind.R2: {
				item.detail = 'r2';
				item.documentation = 'r2';
			} break;
			case TokenKind.R3: {
				item.detail = 'r3';
				item.documentation = 'r3';
			} break;


			//assembly opcodes
			case TokenKind.Move: {
				item.detail = 'move';
				item.documentation = 'move {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Load: {
				item.detail = 'load';
				item.documentation = 'load {dst-reg}, &{src-addr}';
			} break;
			case TokenKind.Copy: {
				item.detail = 'copy';
				item.documentation = 'copy {dst-reg}, #{src-imm}';
			} break;
			case TokenKind.Save: {
				item.detail = 'save';
				item.documentation = 'save &{dst-addr}, {src-reg}';
			} break;
			case TokenKind.Iadd: {
				item.detail = 'iadd';
				item.documentation = 'iadd {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Isub: {
				item.detail = 'isub';
				item.documentation = 'isub {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Band: {
				item.detail = 'band';
				item.documentation = 'band {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Bior: {
				item.detail = 'bior';
				item.documentation = 'bior {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Bxor: {
				item.detail = 'bxor';
				item.documentation = 'bxor {dst-reg}, {src-reg}';
			} break;
			case TokenKind.Call: {
				item.detail = 'call';
				item.documentation = 'call &{dst-addr}';
			} break;
			case TokenKind.Exit: {
				item.detail = 'exit';
				item.documentation = 'exit';
			} break;
			case TokenKind.Push: {
				item.detail = 'push';
				item.documentation = 'push {src-reg}';
			} break;
			case TokenKind.Pull: {
				item.detail = 'pull';
				item.documentation = 'pull {dst-reg}';
			} break;
			case TokenKind.Brnz: {
				item.detail = 'brnz';
				item.documentation = 'brnz &{dst-addr}, {src-reg}';
			} break;
			case TokenKind.Bool: {
				item.detail = 'bool';
				item.documentation = 'bool {src-reg}';
			} break;

		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
