"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { CKEditor, useCKEditorCloud } from '@ckeditor/ckeditor5-react';
import './CKEditorDocument.css';

const LICENSE_KEY =
	'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3Njk4MTc1OTksImp0aSI6ImI2MDJlZDUzLTMwMmItNGY1Yi1hODkwLWJhYjYyY2UwODM5YiIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6ImI0M2IzZjY3In0.aEXyYE7jYDapQn9QTPurxLD7W1zIPIlXsI41UOGUfSyCDDM-oglS21teFuPZzfPdGR5Ec-w69FGVodGLsotFUw';

const CLOUD_SERVICES_TOKEN_URL =
	'https://s1q12qtk5xop.cke-cs.com/token/dev/2af1a39004d387e08268b8755b2aa626166f384d7b39d90212756a98eef1?limit=10';

type CKEditorDocumentProps = {
	documentId: string;
	initialContent?: string;
	onSave?: (content: string) => void;
	onClose?: () => void;
};

export default function CKEditorDocument({
	documentId,
	initialContent = '',
	onSave,
	onClose
}: CKEditorDocumentProps) {
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorMenuBarRef = useRef<HTMLDivElement>(null);
	const editorToolbarRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<HTMLDivElement>(null);
	const editorCkeditorAiRef = useRef<HTMLDivElement>(null);
	const editorInstanceRef = useRef<any>(null);
	const [isLayoutReady, setIsLayoutReady] = useState(false);
	const cloud = useCKEditorCloud({ version: '47.4.0', premium: true, ckbox: { version: '2.9.2' } });

	useEffect(() => {
		setIsLayoutReady(true);
		return () => setIsLayoutReady(false);
	}, []);

	const { DecoupledEditor, editorConfig } = useMemo(() => {
		if (cloud.status !== 'success' || !isLayoutReady) {
			return {};
		}

		const {
			DecoupledEditor,
			Autosave,
			Essentials,
			Paragraph,
			CloudServices,
			Autoformat,
			TextTransformation,
			LinkImage,
			Link,
			ImageBlock,
			ImageToolbar,
			BlockQuote,
			Bold,
			Bookmark,
			CKBox,
			ImageUpload,
			ImageInsert,
			ImageInsertViaUrl,
			AutoImage,
			PictureEditing,
			CKBoxImageEdit,
			CodeBlock,
			TableColumnResize,
			Table,
			TableToolbar,
			Emoji,
			Mention,
			PasteFromOffice,
			FindAndReplace,
			FontBackgroundColor,
			FontColor,
			FontFamily,
			FontSize,
			Fullscreen,
			Heading,
			HorizontalLine,
			ImageCaption,
			ImageResize,
			ImageStyle,
			Indent,
			IndentBlock,
			Code,
			Italic,
			AutoLink,
			ListProperties,
			List,
			MediaEmbed,
			RemoveFormat,
			SpecialCharactersArrows,
			SpecialCharacters,
			SpecialCharactersCurrency,
			SpecialCharactersEssentials,
			SpecialCharactersLatin,
			SpecialCharactersMathematical,
			SpecialCharactersText,
			Strikethrough,
			Subscript,
			Superscript,
			TableCaption,
			TableCellProperties,
			TableProperties,
			Alignment,
			TodoList,
			Underline,
			BalloonToolbar,
			BlockToolbar
		} = cloud.CKEditor;
		const { AIChat, AIEditorIntegration, AIQuickActions, AIReviewMode, PasteFromOfficeEnhanced, FormatPainter, LineHeight, SlashCommand } =
			cloud.CKEditorPremiumFeatures;

		return {
			DecoupledEditor,
			editorConfig: {
				toolbar: {
					items: [
						'undo',
						'redo',
						'|',
						'toggleAi',
						'aiQuickActions',
						'|',
						'formatPainter',
						'findAndReplace',
						'fullscreen',
						'|',
						'heading',
						'|',
						'fontSize',
						'fontFamily',
						'fontColor',
						'fontBackgroundColor',
						'|',
						'bold',
						'italic',
						'underline',
						'strikethrough',
						'subscript',
						'superscript',
						'code',
						'removeFormat',
						'|',
						'emoji',
						'specialCharacters',
						'horizontalLine',
						'link',
						'bookmark',
						'insertImage',
						'insertImageViaUrl',
						'ckbox',
						'mediaEmbed',
						'insertTable',
						'blockQuote',
						'codeBlock',
						'|',
						'alignment',
						'lineHeight',
						'|',
						'bulletedList',
						'numberedList',
						'todoList',
						'outdent',
						'indent'
					],
					shouldNotGroupWhenFull: false
				},
				plugins: [
					AIChat,
					AIEditorIntegration,
					AIQuickActions,
					AIReviewMode,
					Alignment,
					Autoformat,
					AutoImage,
					AutoLink,
					Autosave,
					BalloonToolbar,
					BlockQuote,
					BlockToolbar,
					Bold,
					Bookmark,
					CKBox,
					CKBoxImageEdit,
					CloudServices,
					Code,
					CodeBlock,
					Emoji,
					Essentials,
					FindAndReplace,
					FontBackgroundColor,
					FontColor,
					FontFamily,
					FontSize,
					FormatPainter,
					Fullscreen,
					Heading,
					HorizontalLine,
					ImageBlock,
					ImageCaption,
					ImageInsert,
					ImageInsertViaUrl,
					ImageResize,
					ImageStyle,
					ImageToolbar,
					ImageUpload,
					Indent,
					IndentBlock,
					Italic,
					LineHeight,
					Link,
					LinkImage,
					List,
					ListProperties,
					MediaEmbed,
					Mention,
					Paragraph,
					PasteFromOffice,
					PasteFromOfficeEnhanced,
					PictureEditing,
					RemoveFormat,
					SlashCommand,
					SpecialCharacters,
					SpecialCharactersArrows,
					SpecialCharactersCurrency,
					SpecialCharactersEssentials,
					SpecialCharactersLatin,
					SpecialCharactersMathematical,
					SpecialCharactersText,
					Strikethrough,
					Subscript,
					Superscript,
					Table,
					TableCaption,
					TableCellProperties,
					TableColumnResize,
					TableProperties,
					TableToolbar,
					TextTransformation,
					TodoList,
					Underline
				],
				ai: {
					container: {
						type: 'sidebar',
						element: editorCkeditorAiRef.current,
						showResizeButton: false
					},
					chat: {
						context: {
							document: {
								enabled: true
							},
							urls: {
								enabled: true
							},
							files: {
								enabled: true
							}
						}
					}
				},
				balloonToolbar: ['aiQuickActions', '|', 'bold', 'italic', '|', 'link', 'insertImage', '|', 'bulletedList', 'numberedList'],
				blockToolbar: [
					'toggleAi',
					'|',
					'fontSize',
					'fontColor',
					'fontBackgroundColor',
					'|',
					'bold',
					'italic',
					'|',
					'link',
					'insertImage',
					'insertTable',
					'|',
					'bulletedList',
					'numberedList',
					'outdent',
					'indent'
				],
				cloudServices: {
					tokenUrl: CLOUD_SERVICES_TOKEN_URL
				},
				collaboration: {
					channelId: documentId
				},
				fontFamily: {
					supportAllValues: true
				},
				fontSize: {
					options: [10, 12, 14, 'default', 18, 20, 22],
					supportAllValues: true
				},
				fullscreen: {
					onEnterCallback: (container: HTMLElement) =>
						container.classList.add(
							'editor-container',
							'editor-container_document-editor',
							'editor-container_contains-wrapper',
							'editor-container_include-fullscreen',
							'main-container'
						)
				},
				heading: {
					options: [
						{
							model: 'paragraph' as const,
							title: 'Paragraph',
							class: 'ck-heading_paragraph'
						},
						{
							model: 'heading1' as const,
							view: 'h1' as const,
							title: 'Heading 1',
							class: 'ck-heading_heading1'
						},
						{
							model: 'heading2' as const,
							view: 'h2' as const,
							title: 'Heading 2',
							class: 'ck-heading_heading2'
						},
						{
							model: 'heading3' as const,
							view: 'h3' as const,
							title: 'Heading 3',
							class: 'ck-heading_heading3'
						},
						{
							model: 'heading4' as const,
							view: 'h4' as const,
							title: 'Heading 4',
							class: 'ck-heading_heading4'
						},
						{
							model: 'heading5' as const,
							view: 'h5' as const,
							title: 'Heading 5',
							class: 'ck-heading_heading5'
						},
						{
							model: 'heading6' as const,
							view: 'h6' as const,
							title: 'Heading 6',
							class: 'ck-heading_heading6'
						}
					]
				},
				image: {
					toolbar: [
						'toggleImageCaption',
						'|',
						'imageStyle:alignBlockLeft',
						'imageStyle:block',
						'imageStyle:alignBlockRight',
						'|',
						'resizeImage',
						'|',
						'ckboxImageEdit'
					],
					styles: {
						options: ['alignBlockLeft', 'block', 'alignBlockRight']
					}
				},
				initialData: initialContent || '<p>Type or paste your content here!</p>',
				licenseKey: LICENSE_KEY,
				lineHeight: {
					supportAllValues: true
				},
				link: {
					addTargetToExternalLinks: true,
					defaultProtocol: 'https://',
					decorators: {
						toggleDownloadable: {
							mode: 'manual' as const,
							label: 'Downloadable',
							attributes: {
								download: 'file'
							}
						}
					}
				},
				list: {
					properties: {
						styles: true,
						startIndex: true,
						reversed: true
					}
				},
				mention: {
					feeds: [
						{
							marker: '@',
							feed: []
						}
					]
				},
				placeholder: 'Type or paste your content here!',
				table: {
					contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties']
				}
			}
		};
	}, [cloud, isLayoutReady, documentId, initialContent]);

	const handleSave = () => {
		if (editorInstanceRef.current && onSave) {
			const content = editorInstanceRef.current.getData();
			onSave(content);
		}
	};

	if (cloud.status === 'error') {
		return (
			<div className="flex h-full items-center justify-center bg-red-50">
				<div className="text-center">
					<p className="text-red-600 font-semibold">Failed to load CKEditor</p>
					<p className="text-sm text-red-500 mt-2">{cloud.error?.message}</p>
				</div>
			</div>
		);
	}

	if (cloud.status === 'loading' || !isLayoutReady) {
		return (
			<div className="flex h-full items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
					<p className="text-sm text-slate-600">Loading editor...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full w-full flex flex-col bg-white">
			{/* Header with Save and Close buttons */}
			<div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
				<h2 className="text-lg font-semibold text-slate-900">Document Editor</h2>
				<div className="flex items-center gap-2">
					<button
						onClick={handleSave}
						className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						Save
					</button>
					{onClose && (
						<button
							onClick={onClose}
							className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
						>
							Close
						</button>
					)}
				</div>
			</div>

			{/* CKEditor Container */}
			<div className="flex-1 overflow-auto">
				<div className="main-container">
					<div
						className="editor-container editor-container_document-editor editor-container_contains-wrapper editor-container_include-fullscreen"
						ref={editorContainerRef}
					>
						<div className="editor-container__menu-bar" ref={editorMenuBarRef}></div>
						<div className="editor-container__toolbar" ref={editorToolbarRef}></div>
						<div className="editor-container__editable-wrapper">
							<div className="editor-container__editor-wrapper">
								<div className="editor-container__editor">
									<div ref={editorRef}>
										{DecoupledEditor && editorConfig && (
											<CKEditor
												onReady={(editor: any) => {
													editorInstanceRef.current = editor;
													editorToolbarRef.current?.appendChild(editor.ui.view.toolbar.element);
													editorMenuBarRef.current?.appendChild(editor.ui.view.menuBarView.element);
												}}
												onAfterDestroy={() => {
													editorInstanceRef.current = null;
													if (editorToolbarRef.current) {
														Array.from(editorToolbarRef.current.children).forEach(child => child.remove());
													}
													if (editorMenuBarRef.current) {
														Array.from(editorMenuBarRef.current.children).forEach(child => child.remove());
													}
												}}
												editor={DecoupledEditor}
												config={editorConfig}
											/>
										)}
									</div>
								</div>
							</div>
							<div className="editor-container__sidebar editor-container__sidebar_ckeditor-ai" ref={editorCkeditorAiRef}></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
