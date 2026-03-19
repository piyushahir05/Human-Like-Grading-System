import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

export const gradeAnswer = (data) => client.post('/grade', data)

export const getResults = (filters) => client.get('/results', { params: filters })

export const getResult = (id) => client.get(`/results/${id}`)

export const deleteResult = (id) => client.delete(`/results/${id}`)

export const getStats = () => client.get('/stats')

export const getHealth = () => client.get('/health')

export default client
