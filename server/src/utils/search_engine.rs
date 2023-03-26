use std::sync::Arc;
use std::sync::Mutex;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

use lazy_static::lazy_static;
use tantivy;
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::doc;
use tantivy::query::QueryParser;
use tantivy::query::QueryParserError;
use tantivy::schema::*;
use tantivy::Directory;
use tantivy::Index;
use tantivy::ReloadPolicy;

use crate::config;
use crate::conv_err;

use super::error::AppError;

lazy_static! {
  pub static ref SEARCH_INDEX: Arc<Mutex<Index>> = {
    let index = init();
    Arc::new(Mutex::new(index))
  };
}

fn init() -> Index {
  let mut schema_builder = Schema::builder();

  let path_options = TextOptions::default().set_stored().set_indexing_options(
    TextFieldIndexing::default().set_index_option(IndexRecordOption::WithFreqsAndPositions),
  );

  let body_field_indexing = TextFieldIndexing::default()
    .set_tokenizer("jieba")
    .set_index_option(IndexRecordOption::WithFreqsAndPositions);
  let body_options = TextOptions::default()
    .set_indexing_options(body_field_indexing)
    .set_stored();

  schema_builder.add_text_field("name", TEXT | STORED);
  schema_builder.add_text_field("path", TEXT | STORED);
  schema_builder.add_text_field("body", body_options);
  schema_builder.add_text_field("updated_at", path_options);
  let schema = schema_builder.build();
  let index_path = config!(search_index_path);
  std::fs::create_dir_all(&index_path).unwrap();

  let mmap_directory: Box<dyn Directory> = Box::new(MmapDirectory::open(&index_path).unwrap());
  let index;
  if Index::exists(&*mmap_directory).unwrap() {
    index = Index::open(mmap_directory).unwrap();
  } else {
    index = Index::open_or_create(mmap_directory, schema.clone()).unwrap();
  }
  let tokenizer = tantivy_jieba::JiebaTokenizer {};
  index.tokenizers().register("jieba", tokenizer);

  return index;
}

#[derive(Debug)]
pub struct Doc {
  pub path: String,
  pub name: String,
  pub body: String,
}

conv_err!(tantivy::error::TantivyError);
conv_err!(QueryParserError);

pub fn search_docs(query: &str) -> Result<Vec<Document>, AppError> {
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();

  let reader = index
    .reader_builder()
    .reload_policy(ReloadPolicy::OnCommit)
    .try_into()?;

  let searcher = reader.searcher();
  let name = schema.get_field("name").unwrap();
  let body = schema.get_field("body").unwrap();

  let query_parser = QueryParser::for_index(&index, vec![name, body]);
  let query = query_parser.parse_query(query)?;
  let top_docs = searcher.search(&query, &TopDocs::with_limit(10))?;
  let mut docs = vec![];
  for (_score, doc_address) in top_docs {
    let retrieved_doc = searcher.doc(doc_address)?;
    docs.push(retrieved_doc);
  }
  Ok(docs)
}

pub fn insert_docs(docs: Vec<Doc>, now: &str) -> Result<(), AppError> {
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();

  let mut index_writer = index.writer(10_000_000)?;

  let name = schema.get_field("name").unwrap();
  let path = schema.get_field("path").unwrap();
  let body = schema.get_field("body").unwrap();
  let updated_at = schema.get_field("updated_at").unwrap();

  for doc in docs {
    index_writer.add_document(doc!(
      name => doc.name,
      path => doc.path,
      body => doc.body,
      updated_at => now.to_string(),
    ))?;
  }

  index_writer.commit()?;
  Ok(())
}

#[allow(unused)]
pub fn cleanup(not_updated_at: &str) -> Result<(), AppError> {
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();
  let updated_at = schema.get_field("updated_at").unwrap();

  let mut index_writer = index.writer(10_000_000)?;

  let mut query_parser = QueryParser::for_index(&index, vec![updated_at]);
  query_parser.set_conjunction_by_default();
  let query_str = format!(r#"updated_at:[0 TO {not_updated_at}}}"#);
  let query = query_parser.parse_query(&query_str)?;

  index_writer.delete_query(query)?;

  index_writer.commit()?;
  Ok(())
}

#[allow(unused)]
pub fn cleanup_stale_data(max_stale_secs: u64) -> Result<(), AppError> {
  let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
  let delete_before = (now - (max_stale_secs * 1000) as u128).to_string();
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();
  let updated_at = schema.get_field("updated_at").unwrap();

  let mut index_writer = index.writer(10_000_000)?;

  let mut query_parser = QueryParser::for_index(&index, vec![updated_at]);
  query_parser.set_conjunction_by_default();
  let query_str = format!(r#"updated_at:[0 TO {delete_before}}}"#);
  let query = query_parser.parse_query(&query_str)?;

  index_writer.delete_query(query)?;

  index_writer.commit()?;
  Ok(())
}

#[allow(unused)]
pub fn delete(files: &Vec<String>) -> Result<(), AppError> {
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();
  let path = schema.get_field("path").unwrap();

  let mut index_writer = index.writer(10_000_000)?;

  let mut query_parser = QueryParser::for_index(&index, vec![path]);
  query_parser.set_conjunction_by_default();
  let query_str = files
    .into_iter()
    .map(|f| format!(r#""{f}""#))
    .collect::<Vec<_>>()
    .join(" AND ");
  let query = query_parser.parse_query(&query_str)?;

  index_writer.delete_query(query)?;

  index_writer.commit()?;
  Ok(())
}

#[allow(unused)]
pub fn cleanup_by_path(file_path: &str) -> Result<(), AppError> {
  let index = SEARCH_INDEX.lock().unwrap();
  let schema = index.schema();
  let path = schema.get_field("path").unwrap();

  let mut index_writer = index.writer(10_000_000)?;

  let mut query_parser = QueryParser::for_index(&index, vec![path]);
  query_parser.set_conjunction_by_default();
  let query_str = format!(r#""{file_path}""#);
  let query = query_parser.parse_query(&query_str)?;

  index_writer.delete_query(query)?;

  index_writer.commit()?;
  Ok(())
}
