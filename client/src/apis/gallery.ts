import { post } from "./utils";

export function list_all_images() {
  return post('/gallery/list', {}, 'list_all_images');
}

export function update_index() {
  return post('/gallery/update_index', {}, 'update_index');
}

export function get_job_status() {
  return post('/gallery/get_job_status', {}, 'get_job_status');
}
