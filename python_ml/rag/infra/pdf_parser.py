"""Document processing utilities."""
import io
import logging
from pathlib import Path

import fitz  # PyMuPDF
from bs4 import BeautifulSoup
import html2text
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)


class PDFParser:
    """Parser for PDF documents."""

    @staticmethod
    def parse(file_content: bytes) -> list[dict[str, any]]:
        """
        Parse a PDF file and extract text with page information.

        Args:
            file_content: PDF file bytes

        Returns:
            List of pages with text and metadata
        """
        pages = []
        try:
            pdf_document = fitz.open(stream=file_content, filetype="pdf")

            for page_index in range(len(pdf_document)):
                page = pdf_document[page_index]
                text = page.get_text("text")

                if text.strip():
                    pages.append({
                        "page_number": page_index + 1,
                        "text": text.strip(),
                        "source": f"page_{page_index + 1}",
                    })

            pdf_document.close()
            logger.info(f"Parsed PDF with {len(pages)} pages")

        except Exception as error:
            logger.error(f"Failed to parse PDF: {error}")
            raise

        return pages

    @staticmethod
    def get_metadata(file_content: bytes) -> dict[str, any]:
        """Extract metadata from PDF."""
        try:
            pdf_document = fitz.open(stream=file_content, filetype="pdf")
            metadata = pdf_document.metadata
            page_count = len(pdf_document)
            pdf_document.close()

            return {
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "page_count": page_count,
            }
        except Exception as error:
            logger.error(f"Failed to extract PDF metadata: {error}")
            return {}


class HTMLParser:
    """Parser for HTML documents."""

    @staticmethod
    def parse(content: str) -> dict[str, any]:
        """
        Parse HTML content and extract text.

        Args:
            content: HTML content string

        Returns:
            Dictionary with title, text, and links
        """
        try:
            soup = BeautifulSoup(content, "html.parser")

            # Remove script and style elements
            for element in soup(["script", "style", "nav", "footer", "header"]):
                element.decompose()

            # Get title
            title = ""
            if soup.title:
                title = soup.title.string or ""

            # Convert HTML to markdown-like text
            html_converter = html2text.HTML2Text()
            html_converter.ignore_links = False
            html_converter.ignore_images = True
            html_converter.body_width = 0  # No wrapping

            text = html_converter.handle(str(soup))

            # Clean up the text
            lines = []
            for line in text.split("\n"):
                line = line.strip()
                if line:
                    lines.append(line)

            clean_text = "\n\n".join(lines)

            # Extract links
            links = []
            for link in soup.find_all("a", href=True):
                links.append({
                    "text": link.get_text(strip=True),
                    "href": link["href"],
                })

            logger.info(f"Parsed HTML: title='{title}', text_length={len(clean_text)}")

            return {
                "title": title,
                "text": clean_text,
                "links": links,
            }

        except Exception as error:
            logger.error(f"Failed to parse HTML: {error}")
            raise

    @staticmethod
    async def fetch_and_parse(url: str, timeout: int = 30) -> dict[str, any]:
        """Fetch HTML from URL and parse it."""
        import httpx

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()

            return HTMLParser.parse(response.text)


class MarkdownParser:
    """Parser for Markdown documents."""

    @staticmethod
    def parse(content: str) -> dict[str, any]:
        """
        Parse Markdown content.

        Args:
            content: Markdown content string

        Returns:
            Dictionary with sections
        """
        import re

        sections = []
        current_section = {"Title": "", "content": ""}
        # Strip leading/trailing whitespace first
        content = content.strip()
        lines = content.split("\n")

        in_first_section = True
        first_section_content = []

        for line in lines:
            # Check if it's a heading (with optional leading whitespace)
            heading_match = re.match(r"^\s*(#{1,6})\s+(.+)$", line)
            if heading_match:
                if in_first_section:
                    # Save the first heading as title
                    current_section["title"] = heading_match.group(2)
                    in_first_section = False
                else:
                    if current_section["content"] or current_section["title"]:
                        sections.append(current_section)

                    level = len(heading_match.group(1))
                    current_section = {
                        "title": heading_match.group(2),
                        "level": level,
                        "content": "",
                    }
            else:
                if in_first_section:
                    first_section_content.append(line)
                else:
                    current_section["content"] += line + "\n"

        # Handle empty markdown case
        if not content:
            return {
                "title": "",
                "sections": [],
                "text": "",
            }

        # Add the last section
        if current_section["content"] or current_section["title"]:
            sections.append(current_section)

        # If no sections were created, create one from first section content
        if not sections and first_section_content:
            sections.append({
                "title": "",
                "content": "\n".join(first_section_content).strip(),
            })

        # Clean up content
        for section in sections:
            section["content"] = section["content"].strip()

        full_text = "\n\n".join(section["content"] for section in sections)

        return {
            "title": sections[0]["title"] if sections else "",
            "sections": sections,
            "text": full_text,
        }


class DocxParser:
    """Parser for DOCX documents."""

    @staticmethod
    def parse(file_content: bytes) -> dict[str, any]:
        """
        Parse a DOCX file and extract text.

        Args:
            file_content: DOCX file bytes

        Returns:
            Dictionary with paragraphs
        """
        try:
            docx_document = DocxDocument(io.BytesIO(file_content))

            paragraphs = []
            full_text = []

            for paragraph in docx_document.paragraphs:
                text = paragraph.text.strip()
                if text:
                    paragraphs.append({
                        "text": text,
                        "style": paragraph.style.name if paragraph.style else "Normal",
                    })
                    full_text.append(text)

            logger.info(f"Parsed DOCX with {len(paragraphs)} paragraphs")

            return {
                "paragraphs": paragraphs,
                "text": "\n\n".join(full_text),
            }

        except Exception as error:
            logger.error(f"Failed to parse DOCX: {error}")
            raise


class TextParser:
    """Parser for plain text documents."""

    @staticmethod
    def parse(content: str) -> dict[str, any]:
        """
        Parse plain text content.

        Args:
            content: Plain text content

        Returns:
            Dictionary with lines and paragraphs
        """
        lines = [line.strip() for line in content.split("\n") if line.strip()]

        # Group into paragraphs (separated by empty lines)
        paragraphs = []
        current_paragraph = []

        for line in lines:
            if line:
                current_paragraph.append(line)
            else:
                if current_paragraph:
                    paragraphs.append(" ".join(current_paragraph))
                    current_paragraph = []

        if current_paragraph:
            paragraphs.append(" ".join(current_paragraph))

        return {
            "lines": lines,
            "paragraphs": paragraphs,
            "text": "\n\n".join(paragraphs),
        }


def parse_file(
    file_content: bytes,
    filename: str,
) -> dict[str, any]:
    """
    Parse a file based on its extension.

    Args:
        file_content: File bytes
        filename: Original filename

    Returns:
        Parsed content
    """
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        return {
            "type": "pdf",
            "pages": PDFParser.parse(file_content),
            "metadata": PDFParser.get_metadata(file_content),
        }
    elif extension in [".html", ".htm"]:
        text = file_content.decode("utf-8", errors="replace")
        return {
            "type": "html",
            **HTMLParser.parse(text),
        }
    elif extension == ".md":
        text = file_content.decode("utf-8", errors="replace")
        return {
            "type": "markdown",
            **MarkdownParser.parse(text),
        }
    elif extension in [".docx", ".doc"]:
        return {
            "type": "docx",
            **DocxParser.parse(file_content),
        }
    elif extension in [".txt", ".text"]:
        text = file_content.decode("utf-8", errors="replace")
        return {
            "type": "text",
            **TextParser.parse(text),
        }
    else:
        # Try to treat as text
        try:
            text = file_content.decode("utf-8", errors="replace")
            return {
                "type": "text",
                **TextParser.parse(text),
            }
        except Exception:
            raise ValueError(f"Unsupported file type: {extension}")
